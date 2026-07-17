"""
提供帐户相关实用工具。
"""

from typing import Annotated

from fastapi import Depends

from gdut_course_grabber.context.account import account_hub
from gdut_course_grabber.utils.account import AccountEntry

__all__ = ["AccountDep"]


def _account_parameters(username: str) -> AccountEntry:
    """
    解析参数为帐户。

    Args:
        username (str): 用户名。

    Returns:
        AccountEntry: 解析结果。
    """

    return account_hub.accounts[username]


AccountDep = Annotated[AccountEntry, Depends(_account_parameters)]
