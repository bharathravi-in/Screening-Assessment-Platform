FROM node:20-alpine

RUN addgroup -S sandbox && adduser -S sandbox -G sandbox

WORKDIR /code

USER sandbox

ENTRYPOINT ["node"]
CMD ["solution.js"]
