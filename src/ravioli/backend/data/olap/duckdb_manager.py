import duckdb
import os
import pandas as pd
import logging
from ravioli.backend.core.config import settings
from ravioli.backend.core.database import SessionLocal
from ravioli.backend.core.models import SystemSetting

from ravioli.backend.data.olap.ingestion.ingestor import DataIngestor

logger = logging.getLogger(__name__)

class DuckDBManager:
    _instance = None
    _connection = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(DuckDBManager, cls).__new__(cls)
        return cls._instance

    @property
    def connection(self):
        if self._connection is None:
            # Ensure the directory exists
            os.makedirs(os.path.dirname(settings.duckdb_path), exist_ok=True)
            self._connection = duckdb.connect(str(settings.duckdb_path))
            
            # Try to attach Motherduck if configured
            self._attach_motherduck()
            
        return self._connection

    def _attach_motherduck(self):
        """
        Check for Motherduck token in system_settings and attach if found.
        Handles workspace mode where aliases might be restricted.
        """
        # Check if ravioli is already specifically attached as a Motherduck DB
        try:
            res = self._connection.execute("PRAGMA show_databases").fetchall()
            logger.info(f"Currently attached databases: {res}")
            # Be safe with tuple length as it varies between DuckDB versions/modes
            for row in res:
                if row[0] == 'ravioli':
                    # If we have path info, check for md: prefix
                    if len(row) > 1 and str(row[1]).startswith('md:'):
                        logger.info("Motherduck 'ravioli' database is already connected.")
                        return
                    elif len(row) == 1:
                        # If only name is present, it's ambiguous. 
                        # We'll log it but NOT return early so we can verify with a real ATTACH attempt.
                        logger.info(f"Database '{row[0]}' found in session, verifying cloud status...")
        except Exception as e:
            logger.error(f"Error checking attached databases: {e}")
            pass

        db = SessionLocal()
        try:
            setting = db.query(SystemSetting).filter(SystemSetting.key == "motherduck").first()
            if setting and "token" in setting.value and setting.value["token"]:
                from ravioli.backend.core.encryption import decrypt_value
                token = decrypt_value(setting.value["token"])
                logger.info("Motherduck token found, preparing to attach...")
                # Only initialize Motherduck if it's not already set up
                try:
                    self._connection.execute("INSTALL motherduck; LOAD motherduck;")
                    # Check if token is already set to avoid initialization error
                    current_token = self._connection.execute("SELECT current_setting('motherduck_token')").fetchone()[0]
                    if not current_token:
                        self._connection.execute(f"SET motherduck_token='{token}';")
                except Exception as init_err:
                    if "can only be set during initialization" not in str(init_err):
                        try:
                            self._connection.execute(f"SET motherduck_token='{token}';")
                        except:
                            pass
                
                # IMPORTANT: The following management logic must run every time
                # Force multi-database mode so we can see 'ravioli' as a separate DB
                try:
                    self._connection.execute("SET motherduck_attach_mode='multi';")
                except:
                    pass
                
                # 1. Ensure the 'ravioli' database exists in the cloud
                try:
                    # In workspace mode, we attach 'md:' directly to run management commands
                    try:
                        self._connection.execute("ATTACH 'md:'")
                    except Exception as e:
                        if "already attached" not in str(e).lower():
                            logger.error(f"Failed to attach workspace root: {e}")
                    
                    self._connection.execute("CREATE DATABASE IF NOT EXISTS ravioli")
                except Exception as create_err:
                    logger.error(f"Creation of 'ravioli' database failed: {create_err}")
                
                # 2. Specifically mount the 'md:ravioli' cloud database locally
                try:
                    logger.info("Attempting to ATTACH 'md:ravioli'...")
                    # We try with an alias first, fallback to canonical name for workspace mode
                    try:
                        self._connection.execute("ATTACH 'md:ravioli' AS ravioli")
                    except Exception as alias_err:
                        if "aliases are not yet supported" in str(alias_err):
                            self._connection.execute("ATTACH 'md:ravioli'")
                        else:
                            raise alias_err
                    
                    # Verify Identity & Context
                    id_info = self._connection.execute("SELECT current_user(), current_database()").fetchone()
                    logger.info(f"Successfully attached! Cloud Identity: {id_info[0]} | Active DB: {id_info[1]}")
                except Exception as attach_err:
                    if "already attached" not in str(attach_err).lower():
                        logger.error(f"Could not attach 'md:ravioli': {attach_err}")
                        # Final fallback
                        try:
                            self._connection.execute("ATTACH 'md:'")
                        except:
                            pass
                except Exception as e:
                    logger.error(f"Failed to attach Motherduck: {e}")
        except Exception as e:
            logger.error(f"Error fetching Motherduck settings: {e}")
        finally:
            db.close()

    def _get_remote_db_name(self):
        """Find the name of the attached Motherduck database."""
        try:
            res = self.connection.execute("PRAGMA show_databases").fetchall()
            # 1. Look for 'ravioli' (our preferred dedicated db)
            for row in res:
                if row[0] == 'ravioli':
                    return 'ravioli'
            
            # 2. Look for 'motherduck' alias
            for row in res:
                if row[0] == 'motherduck':
                    return 'motherduck'
            
            # 3. If no preferred names, look for the first non-standard database
            # Standard: 'main', 'temp', 'system'
            remote_name = 'motherduck'
            for row in res:
                if row[0] not in ('main', 'temp', 'system', 'memory'):
                    remote_name = row[0]
                    break
            
            logger.info(f"Using Motherduck remote database: {remote_name}")
            return remote_name
        except Exception as e:
            logger.error(f"Error finding remote db name: {e}")
            return 'motherduck'

    def reconnect(self):
        """
        Close existing connection and force a new one on next access.
        Used when settings change.
        """
        if self._connection:
            try:
                self._connection.close()
            except Exception as e:
                logger.warning("Failed to close existing DuckDB connection during reconnect: %s", e)
        self._connection = None

    def list_tables(self):
        """
        List all user tables across all schemas in the DuckDB database.
        """
        conn = self.connection
        # Using information_schema to see all tables
        query = """
            SELECT table_schema || '.' || table_name 
            FROM information_schema.tables 
            WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
        """
        return [row[0] for row in conn.execute(query).fetchall()]

    def query(self, sql: str):
        """
        Execute a query and return results as a list of dictionaries.
        Ensures results are JSON serializable (handles timestamps and NaNs).
        """
        df = self.connection.execute(sql).fetchdf()
        
        # Convert all timestamp columns to ISO format strings
        for col in df.select_dtypes(include=['datetime64', 'datetimetz']).columns:
            df[col] = df[col].dt.strftime('%Y-%m-%d %H:%M:%S')
        
        # Replace NaN/NaT with None for JSON compliance
        return df.where(pd.notnull(df), None).to_dict(orient='records')

    def is_motherduck_connected(self):
        """Check if Motherduck database is attached."""
        try:
            res = self.connection.execute("PRAGMA show_databases").fetchall()
            # Verify it's actually a Motherduck connection by checking for 'md:' prefix 
            # or 'ravioli' name (our specific alias)
            for row in res:
                if row[0] in ('ravioli', 'motherduck'):
                    return True
                if len(row) > 1 and str(row[1]).startswith('md:'):
                    return True
            return False
        except Exception:
            return False

    def get_table_diff(self, schema: str, table: str):
        """Calculate diff between local and remote Motherduck table."""
        if not self.is_motherduck_connected():
            return {"error": "Motherduck not connected"}
        
        remote_db = self._get_remote_db_name()
        local_table = f'"{schema}"."{table}"'
        remote_table = f'{remote_db}."{schema}"."{table}"'
        
        try:
            # Check if local exists
            local_exists = self.connection.execute(f"SELECT count(*) FROM information_schema.tables WHERE table_schema='{schema}' AND table_name='{table}'").fetchone()[0] > 0
            if not local_exists:
                return {"error": f"Local table {local_table} does not exist"}
            
            # Check if remote exists
            # We must be careful about remote schema existence
            try:
                self.connection.execute(f"CREATE SCHEMA IF NOT EXISTS {remote_db}.\"{schema}\"")
            except Exception:
                pass # Might fail if read-only or other issues, but we try

            remote_exists = self.connection.execute(f"SELECT count(*) FROM information_schema.tables WHERE table_catalog='{remote_db}' AND table_schema='{schema}' AND table_name='{table}'").fetchone()[0] > 0
            
            diff = {
                "total_local": self.connection.execute(f"SELECT count(*) FROM {local_table}").fetchone()[0],
                "total_remote": 0,
                "added": 0,
                "removed": 0,
                "status": "diverged"
            }

            if not remote_exists:
                diff["added"] = diff["total_local"]
                diff["status"] = "local_only"
                return diff

            diff["total_remote"] = self.connection.execute(f"SELECT count(*) FROM {remote_table}").fetchone()[0]
            
            # Rows in local not in remote (Additions)
            diff["added"] = self.connection.execute(f"SELECT count(*) FROM (SELECT * FROM {local_table} EXCEPT SELECT * FROM {remote_table})").fetchone()[0]
            
            # Rows in remote not in local (Deletions from local perspective)
            diff["removed"] = self.connection.execute(f"SELECT count(*) FROM (SELECT * FROM {remote_table} EXCEPT SELECT * FROM {local_table})").fetchone()[0]
            
            if diff["added"] == 0 and diff["removed"] == 0:
                diff["status"] = "synced"
            
            return diff
        except Exception as e:
            logger.error(f"Error diffing table {schema}.{table}: {e}")
            return {"error": str(e)}

    def sync_table(self, schema: str, table: str, direction: str = "push"):
        """Sync table between local and remote."""
        if not self.is_motherduck_connected():
            raise Exception("Motherduck not connected")

        remote_db = self._get_remote_db_name()
        local_table = f"\"{schema}\".\"{table}\""
        remote_table = f"\"{remote_db}\".\"{schema}\".\"{table}\""
        
        if direction == "push":
            logger.info(f"Sync: Pushing {local_table} -> {remote_table}")
            # Ensure the schema exists in the remote database
            self.connection.execute(f"CREATE SCHEMA IF NOT EXISTS \"{remote_db}\".\"{schema}\"")
            # Push table data
            self.connection.execute(f"CREATE OR REPLACE TABLE {remote_table} AS SELECT * FROM {local_table}")
            
            # VERIFICATION: Check if the table actually has data in Motherduck
            remote_count = self.connection.execute(f"SELECT count(*) FROM {remote_table}").fetchone()[0]
            logger.info(f"Sync: Push completed. Verified {remote_count} rows in Motherduck for {remote_table}")
            
            # WAKE UP THE SIDEBAR: Force Motherduck to update its metadata
            try:
                self.connection.execute("CALL md_update_catalog()")
                # LOG EXPLORATION: Show what's in there now
                schemas = self.connection.execute(f"SELECT schema_name FROM \"{remote_db}\".information_schema.schemata").fetchall()
                logger.info(f"Sync: Current cloud schemas in {remote_db}: {[s[0] for s in schemas]}")
            except Exception as e:
                logger.info(f"Sync: Could not refresh catalog: {e}")
        else:
            logger.info(f"Sync: Pulling {remote_table} -> {local_table}")
            # Ensure the schema exists locally
            self.connection.execute(f"CREATE SCHEMA IF NOT EXISTS \"{schema}\"")
            # Pull table data
            self.connection.execute(f"CREATE OR REPLACE TABLE {local_table} AS SELECT * FROM {remote_table}")
            
            # Get local count
            local_count = self.connection.execute(f"SELECT count(*) FROM {local_table}").fetchone()[0]
            logger.info(f"Sync: Pull completed. Verified {local_count} rows locally for {local_table}")
        
        return self.get_table_diff(schema, table)

duckdb_manager = DuckDBManager()
data_ingestor = DataIngestor(duckdb_manager)
