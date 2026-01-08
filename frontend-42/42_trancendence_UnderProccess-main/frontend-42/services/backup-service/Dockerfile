FROM alpine:3.18

RUN apk add --no-cache sqlite

WORKDIR /app

COPY backup.sh .
RUN chmod +x backup.sh

CMD ["./backup.sh"]
