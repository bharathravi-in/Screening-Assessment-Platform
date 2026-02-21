FROM eclipse-temurin:21-jdk-alpine

RUN addgroup -S sandbox && adduser -S sandbox -G sandbox

WORKDIR /code

USER sandbox

ENTRYPOINT ["sh", "-c", "javac Solution.java && java Solution"]
