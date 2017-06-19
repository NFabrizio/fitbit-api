# Fitbit Hapi API
Relatively simple API for communicating with Fitbit using Hapi, Node, OAuth2 and  
implemented with promises.  
*This project uses and requires Node, and these instructions assume NPM is  
installed. A developer account with Fitbit is also required for this application  
to work properly.*

## Installation and Set Up
Below are the instructions for installing the fitbit-hapi-api repo. Go to the  
applicable section by clicking the link below. *These instruction are valid as of  
2017.06.19.*

* [Environment Set Up](#environment)
* [Repo Set Up](#repo)
* [Create Configuration File](#config)
* [Starting the Application](#app-start)

### <a name="environment"></a>Environment Set Up
1. On your local machine, install nodejs and npm.

### <a name="repo"></a>Repo Set Up
1. Fork the fitbit-hapi-api Github repo
  1. In a web browser, visit https://github.com/NFabrizio/fitbit-hapi-api
  2. Click the Fork button in the upper right corner of the screen
  3. In the "Where should we fork this repository?" pop up, select your username  
    Github should create a fork of the repo in your account
2. Clone your fork of the app
  1. In the terminal on your local environment, navigate to the directory where  
    you want to clone the app  
    `cd ~/path/to/your/directory`
  2. In the terminal, run:  
    `git clone [clone-url-for-your-fork]`  
    The URL should be in the format git@github.com:YourUsername/fitbit-hapi-api.git

### <a name="config"></a>Create Configuration File
1. In your local environment, create a file named `config.json` at the path  
  `/config/config.json` relative to the root directory where you cloned the  
  fitbit-hapi-api repo.
2. Make the file format similar to the following, but use the developer  
  credentials provided to you by Fitbit at https://dev.fitbit.com/apps/new.
  ```javascript
  {
    "fitbit_creds": {
      "clientId": "your-fitbit-client-id",
      "clientSecret": "your-fitbit-client-secret"
    }
  }
  ```

### <a name="app-start"></a>Starting the Application
1. Install the required NPM packages
  1. In the terminal on your local environment, navigate to the root directory  
    where you cloned the app  
    `cd ~/path/to/your/directory`  
  2. In the terminal on your local environment, run:  
    `npm install`  
    This should install all of the required packages to run the application
2. Start the application
  1. In the terminal on your local environment, navigate to the root directory  
    where you cloned the app  
    `cd ~/path/to/your/directory`  
  2. In the terminal on your local environment, run:  
    `npm start`  
    This should start the application at http://localhost:8080
