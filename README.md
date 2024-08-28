# README #

### Purpose ###
It's a secret. If you don't know, you shouldn't be looking at this. Go away.

### Setup ###
### NODE.JS ###
download and install node.js  
https://nodejs.org/en/

### IDE/EDITOR ###
Install Visual Studio Code (what I'm using) from:  
https://code.visualstudio.com/Download  

OR your favorite IDE/editor  
http://www.sublimetext.com/  
https://www.jetbrains.com/webstorm/download/  
https://atom.io/  
http://brackets.io/  

### MONGODB ###
download and install MongoDB (v3.2 as of this writing)
https://www.mongodb.com/download-center?jmp=nav#community

create a folder where your database will reside if running locally. 
create a .bat file with the following contents:
mongod -dbpath d:\ruin\development\database\data
    (change the path to wherever you want to store your local db)
run the .bat file or command and that will start the mongo daemon
you can connect to the mongo db by typing: mongo 
OR you can try a GUI (highly recommended) like mongoChef, mongoVUE, RoboMongo  
http://3t.io/mongochef/download/core/platform/

### GETTING THE SOURCE CODE ###
Clone the bitbucket repos for:  
ruinsite (server side code)  
ruin-react (react code)  

### FIRST TIME PROJECT INSTALLATIONS ###
Open up a command prompt and install these globally:  
`npm install -g gulp karma-cli bower mocha typings tslint`  

navigate to the RuinSite folder (same path as this README) and run:  
`npm install`  

### TYPESCRIPT ###
then install these typescript libraries for RuinSite from the command line:
`typings install`
Open up the RuinSite project and build it (Ctrl-Shift-B in VS Code)
    OR navigate to the RuinSite project and type:
    `gulp build` (to build)  
    `gulp` (to launch)  
    (Ctrl-C to cancel)  

Now, if you're running on windows and want to just have a .bat file that runs all of this, 
Create a .bat file and copy/paste this (change paths accordingly):

start "db" cmd /c mongod -dbpath d:\ruin\development\database\data

cd d:\ruin\development\ruinsite\
start "server" cmd /c gulp

cd d:\ruin\development\ruin-react\
start "web" cmd /c npm start

### POPULATING GAME DATA ###
To get game data into your local mongo db, run this from the proj folder after you've built the RuinSite project (this will take a few minutes)
this is for Steam games:  
`node build/server/scheduledjobs.js SyncGamesLibrary`  
this is for all other games:  
`node build/server/scheduledjobs.js SyncIGDBGamesLibrary`  

`node build/server/scheduledjobs.js SyncIGDBSingleGame "Warhammer 40,000: Darktide"`


### POPULATING USER DATA ###
This will create 10 test users with games, groups, friends, etc. It is re-runnable and it will wipe out previous test users only if you run it again.  
`node build/server/junkdata/miniseed.js`

### TYPICAL WORKFLOW ###
After the initial set up, to get the servers up and running only require 3 commands (across 3 seperate terminals):  
`npm install` -> `npm run build` -> `npm start`  
`npm install` -> `gulp build` -> `gulp`  
`mongod`  

