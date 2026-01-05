FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir pdm

COPY . .
RUN pdm install --prod

EXPOSE 5000

CMD ["pdm", "run", "python", "-m", "gdut_course_grabber", "-P", "-p", "5000"]