"""
GDUTCourseGrabber 应用。
"""

import contextlib
from dataclasses import dataclass
import logging
import socket
import webbrowser

import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from gdut_course_grabber import api
from gdut_course_grabber.context.path import static_path


@dataclass(frozen=True, kw_only=True)
class Config:
    port: int = 0


logger = logging.getLogger(__name__)

app = FastAPI()

app.mount("/api", api.app)
app.mount("/", StaticFiles(directory=static_path, html=True))


def run(config: Config | None = None) -> None:
    """
    运行 GDUTCourseGrabber。

    Args:
        config (Config | None, optional): 配置。
    """
    if config is None:
        config = Config()

    with (
        socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock4,
        socket.socket(socket.AF_INET6, socket.SOCK_STREAM) as sock6,
    ):
        sock4.bind(("127.0.0.1", config.port))
        sock4.listen()

        port = sock4.getsockname()[1]

        sock6.bind(("::1", port))
        sock6.listen()

        conf = uvicorn.Config(app, host="localhost", port=port)
        server = uvicorn.Server(config=conf)

        url = f"http://localhost:{port}"

        logger.info("server running on %s", url)
        webbrowser.open(url)

        with contextlib.suppress(KeyboardInterrupt):
            server.run(sockets=[sock4, sock6])
