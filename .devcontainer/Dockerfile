FROM nodered/node-red:latest
USER root
RUN mkdir -p /data && chown -R node-red:node-red /data
RUN apk add --no-cache git
USER node-red
