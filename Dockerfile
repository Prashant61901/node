#Sample Dockerfile for NodeJS Apps

FROM node:20


WORKDIR package*.json

COPY ["package.json", "package-lock.json*", "./"]

RUN npm install --production

COPY . .

EXPOSE 3000

CMD [ "node", "index.js" ]