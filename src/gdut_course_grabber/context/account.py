"""
提供账号管理器上下文。
"""

from gdut_course_grabber.context.path import platform_dirs
from gdut_course_grabber.utils.account import AccountHub

__all__ = ["account_hub"]

_PATH = platform_dirs.user_data_path / "account.json"


account_hub = AccountHub(_PATH)
"""
账号管理器。
"""
