"""
GDUTCourseGrabber 程序入口。
"""

import argparse
import logging

from gdut_course_grabber import application


def main() -> None:
    logging.basicConfig(level=logging.INFO)

    parser = argparse.ArgumentParser()
    parser.add_argument("--port", "-p", help="port to bind", type=int, required=False, default=0)
    args = parser.parse_args()

    config = application.Config(port=args.port)

    application.run(config)


if __name__ == "__main__":
    main()
