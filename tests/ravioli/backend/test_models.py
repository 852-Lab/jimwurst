from ravioli.backend.core import models

def test_model_table_names():
    """Verify that all models have the correct table and schema names after the rename."""
    assert models.Analysis.__tablename__ == "analyses"
    assert models.Analysis.__table_args__["schema"] == "app"
    
    assert models.AnalysisLog.__tablename__ == "analysis_logs"
    assert models.AnalysisLog.__table_args__["schema"] == "app"
    
    assert models.DataSource.__tablename__ == "data_sources"
    assert models.DataSource.__table_args__["schema"] == "app"
    
    assert models.Insight.__tablename__ == "insights"
    assert models.Insight.__table_args__["schema"] == "app"

def test_model_relationships():
    """Verify relationships are correctly defined after renames."""
    # Analysis -> AnalysisLog
    assert "logs" in models.Analysis.__mapper__.relationships
    assert models.Analysis.__mapper__.relationships["logs"].mapper.class_ == models.AnalysisLog
    
    # AnalysisLog -> Analysis
    assert "analysis" in models.AnalysisLog.__mapper__.relationships
    assert models.AnalysisLog.__mapper__.relationships["analysis"].mapper.class_ == models.Analysis
    
    # Insight -> Analysis
    assert "analysis" in models.Insight.__mapper__.relationships
    assert models.Insight.__mapper__.relationships["analysis"].mapper.class_ == models.Analysis

def test_user_and_group_models():
    """Verify User and Group models are correctly defined."""
    assert models.User.__tablename__ == "users"
    assert models.User.__table_args__["schema"] == "app"
    
    assert models.UserGroup.__tablename__ == "user_groups"
    assert models.UserGroup.__table_args__["schema"] == "app"
    
    assert models.UserGroupMember.__tablename__ == "user_group_members"
    assert models.UserGroupMember.__table_args__["schema"] == "app"

def test_user_relationships():
    """Verify User relationships."""
    assert "data_sources" in models.User.__mapper__.relationships
    assert "groups" in models.User.__mapper__.relationships
    
    # Check many-to-many with groups
    groups_rel = models.User.__mapper__.relationships["groups"]
    assert groups_rel.secondary.name == "user_group_members"
    assert groups_rel.mapper.class_ == models.UserGroup

def test_group_relationships():
    """Verify Group relationships."""
    assert "members" in models.UserGroup.__mapper__.relationships
    
    # Check many-to-many with users
    members_rel = models.UserGroup.__mapper__.relationships["members"]
    assert members_rel.secondary.name == "user_group_members"
    assert members_rel.mapper.class_ == models.User
