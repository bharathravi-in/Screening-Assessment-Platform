FROM python:3.12-alpine

RUN addgroup -S sandbox && adduser -S sandbox -G sandbox

WORKDIR /code

USER sandbox

ENTRYPOINT ["python3"]
CMD ["solution.py"]
