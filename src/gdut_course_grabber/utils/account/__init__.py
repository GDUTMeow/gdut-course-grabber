"""
提供账号管理相关实用工具。
"""

import os
from dataclasses import dataclass
from types import MappingProxyType

from pydantic import TypeAdapter

from gdut_course_grabber.models import Account
from gdut_course_grabber.utils.eas import EasClient


@dataclass(kw_only=True)
class AccountEntry:
    """
    账户条目。

    指示账号及其相关联的教务系统客户端。
    """

    account: Account
    client: EasClient


class AccountHub:
    """
    账号管理器。

    用于提供账号对应的教务系统客户端实例。
    """

    _accounts: dict[str, AccountEntry]

    path: str | os.PathLike[str]

    @property
    def accounts(self) -> MappingProxyType[str, AccountEntry]:
        """
        账号。
        """

        return MappingProxyType(self._accounts)

    def __init__(self, path: str | os.PathLike[str]) -> None:
        """
        初始化 `AccountHub`。
        """

        self._accounts = {}
        self.path = path

        self._load_accounts()

    def _load_accounts(self) -> None:
        if not os.path.exists(self.path):
            return

        with open(self.path, "rb") as fp:
            json = fp.read()

        accounts = TypeAdapter(list[Account]).validate_json(json)
        for account in accounts:
            self.add_account(account)

    def _save_accounts(self) -> None:
        accounts = [account.account for account in self._accounts.values()]
        json = TypeAdapter(list[Account]).dump_json(accounts)

        with open(self.path, "wb") as fp:
            fp.write(json)

    def add_account(self, account: Account) -> None:
        client = EasClient(account)
        entry = AccountEntry(account=account, client=client)
        self._accounts[account.username] = entry
        self._save_accounts()

    def remove_account(self, username: str) -> None:
        del self._accounts[username]
