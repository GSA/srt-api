## Node Building Image
FROM node:16

# create app directory
WORKDIR /opt/api

# install app dependencies
COPY package*.json ./
COPY .sequelizerc ./
COPY .snyk ./

# Use to get it to run locally: ENV JWT_SECRET=abc123

RUN touch winston.log.json

RUN npm cache clean --force

# Check environment and install dependencies
# Note: When the NODE_ENV environment variable is set to 'production' npm 
#       will not install modules listed in devDependencies
# Reference: https://docs.npmjs.com/cli/v8/commands/npm-install
RUN npm install

# Bundle app source
COPY server/ ./server

#see https://docs.cloudfoundry.org/devguide/deploy-apps/push-docker.html
COPY docker/conf/passwd /etc/passwd

# expose port
EXPOSE 8080

# start app
CMD [ "node", "server/server.js" ]