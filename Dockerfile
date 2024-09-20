#Sample Dockerfile for NodeJS Apps

FROM node:20


WORKDIR package*.json

COPY ["package.json", "package-lock.json*", "./"]

RUN npm install --production

COPY . .

EXPOSE 8080

CMD [ "node", "index.js" ]