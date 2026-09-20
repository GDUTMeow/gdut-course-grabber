"""
提供账号相关 API。
"""

from fastapi import APIRouter

from gdut_course_grabber.api.types import ApiResponse, KeyValuePair
from gdut_course_grabber.context.account import account_hub
from gdut_course_grabber.models import Account

router = APIRouter()


@router.get("/")
def get_accounts() -> ApiResponse[list[Account]]:
    """
    获取账号列表路由。

    Returns:
        ApiResponse[list[Account]]: 账号列表。
    """

    return ApiResponse(data=[account.account for account in account_hub.accounts.values()])


@router.post("/")
def add_account(account: Account) -> ApiResponse[None]:
    """
    添加账号路由。
    """

    account_hub.add_account(account)
    return ApiResponse(data=None)


@router.delete("/")
def remove_account(username: str) -> ApiResponse[None]:
    """
    移除账号路由。
    """

    account_hub.remove_account(username)
    return ApiResponse(data=None)
