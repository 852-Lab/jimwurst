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
        """
        db = SessionLocal()
        try:
            setting = db.query(SystemSetting).filter(SystemSetting.key == "motherduck").first()
            if setting and "token" in setting.value and setting.value["token"]:
                token = setting.value["token"]
                logger.info("Motherduck token found, attaching to Motherduck...")
                try:
                    self._connection.execute(f"INSTALL motherduck; LOAD motherduck;")
                    self._connection.execute(f"SET motherduck_token='{token}';")
                    self._connection.execute("ATTACH 'md:' AS motherduck")
                    logger.info("Successfully attached to Motherduck as 'motherduck'")
                except Exception as e:
                    logger.error(f"Failed to attach Motherduck: {e}")
        except Exception as e:
            logger.error(f"Error fetching Motherduck settings: {e}")
        finally:
            db.close()

    def reconnect(self):
        """
        Close existing connection and force a new one on next access.
        Used when settings change.
        """
        if self._connection:
            try:
                self._connection.close()
            except:
                pass
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

duckdb_manager = DuckDBManager()
data_ingestor = DataIngestor(duckdb_manager)
