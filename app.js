var express = require('express')
var bodyParser = require('body-parser')
var path = require('path')
var http = require('http')
//Uncomment the next line to use the local .env file for testing
//Comment it out befor uploading to heroku
var dotenv = require('dotenv').config()
var WebSocket = require('ws')
var ip = require('ip')
//Global Variables
var httpport = process.env.PORT || 80

var app = express()

var server = http.createServer(app)

var wss = new WebSocket.Server({server: server})

//Setup EJS view engine
app.set('view engine','ejs')
app.set('views', path.join(__dirname , "views"))

//Set static resources path
app.use(express.static(path.join(__dirname,"public")))


//Routes

//Root
app.get('/', function(req, res){
	//This is the root route
	res.render('demo',{
		chatServerIp : ip.address(),
		chatServerPort : httpport
	});
})

app.get('/js/vigochat.js', function(req, res){
	res.send("Suck my dick")
})

server.listen(httpport,()=>{
	console.log("Server started on port " + httpport)
})

/*
	This is the ChatClient object that defines the clients connected to the chat
*/
class ChatClient{
	constructor(conn){
		this.connection = conn 
		this.handle = "⏳"
	}
	getHandle(){
		return this.handle
	}
	setHandle(handle){
		this.handle = handle
	}
	setConnection(conn){
		this.connection = conn
	}
	getConnection(){
		return this.connection
	}
	sendMessage(msg){
		this.connection.send(msg)
		console.log("message:" + msg)
	}
}

var chat_clients = []

/*
	Function will take in a handle and return the web socket associated with that handle
*/
function getConnectionForHandle(handle){
	for(var index = 0;index < chat_clients.length;index++){
		if(chat_clients[index].handle == handle){
			return chat_clients[index].connection
		}
	}
}

function getChatClientForConnection(conn){
	for(var index = 0; index < chat_clients.length; index++){
		if(chat_clients[index].connection == conn){
			return chat_clients[index]
		}
	}
}

function getChatClientForHandle(handle){
	for(var index = 0; index < chat_clients.length; index++){
		if(chat_clients[index].handle == handle){
			return chat_clients[index]
		}
	}
}
/*
	Function will take in a web socket and return the user handle associated with that socket
*/
function getHandleForConnection(conn){
	for(var index = 0;index < chat_clients.length;index++){
		if(chat_clients[index].connection == conn){
			return chat_clients[index].handle
		}
	}
}
/*
	Function sends a message to all chat clients except for the connection specified
*/
function sendMessageToAllClients(msg,conn){
	for(var index = 0; index < chat_clients.length; index++){
		//Except for yourself
		if(chat_clients[index].connection != conn){
			chat_clients[index].sendMessage(msg)
		}
	}
}

function checkHandleAvailability(handle){
	for(var index = 0; index < chat_clients.length; index++){
		if(chat_clients[index].handle == handle){
			return false
		}
	}
	return true
}

function removeChatClient(conn){
	console.log("Removing client " + conn)
	for(var index = 0; index < chat_clients.length; index++){
		if(chat_clients[index].connection == conn){
			chat_clients.splice(index,1)
		}
	}
	updateUserLists(conn)
}

function getChatClientHandles(){
	var clientHandles = []
	for(var index = 0; index < chat_clients.length; index++){
		clientHandles.push(chat_clients[index].getHandle())
	}
	return clientHandles
}

function updateUserLists(conn){
	msgResponse = {
		'type' : 'user-list-response',
		'userlist' : getChatClientHandles()
	}
	for(var index = 0; index < chat_clients.length; index++){
		if(chat_clients[index].connection != conn && chat_clients[index].connection.readyState == WebSocket.OPEN){
			chat_clients[index].sendMessage(JSON.stringify(msgResponse));
		}else if(chat_clients[index].connection.readyState == WebSocket.CLOSED){
			chat_clients.splice(index,1)
			updateUserLists(conn)
		}
	}
}
//When a connection is established
wss.on('connection', (ws,req)=>{
	var client = req.connection.remoteAddress;
	console.log(client + " connected.")
	//Create a ChatClient for this connection
	chat_clients.push(new ChatClient(ws))
	//When the client sends a message
	ws.on('message', (msg)=>{
		console.log(client + " sent " + msg);
		var messageVariables = JSON.parse(msg)
		var messageType = messageVariables.type
		//Check if this is a request to set the handle
		if(messageType == "set-handle-request"){
			var handleRequested = messageVariables.handle
			var currentClient = getChatClientForConnection(ws)
			if(checkHandleAvailability(handleRequested)){
				currentClient.setHandle(messageVariables.handle)
				var msgResponse = {
					'type' : 'set-handle-response',
					'response' : 'set-handle-successfully'
				}
				currentClient.sendMessage(JSON.stringify(msgResponse))
				updateUserLists(ws)
			}else{
				var msgResponse = {
					'type' : 'set-handle-response',
					'response' : 'handle-unavailable'
				}
				currentClient.sendMessage(JSON.stringify(msgResponse))
			}
		}
		//Check if this is a request to send a message
		if(messageType == "message"){
			var messageSent = messageVariables.message;
			var messageRecipientHandle = messageVariables.recipient
			//For everyone
			if(messageRecipientHandle == "all"){
				var msgResponse = {
					'type' : 'message',
					'from' : getHandleForConnection(ws),
					'message' : messageSent
				}
				sendMessageToAllClients(JSON.stringify(msgResponse),ws)
			}
			//For a specific recipient
			else{
				var recipient = getChatClientForHandle(messageRecipientHandle)
				var msgResponse = {
					'type' : 'private-message',
					'from' : getHandleForConnection(ws),
					'message' : messageSent
				}
				recipient.sendMessage(JSON.stringify(msgResponse))
			}
		}
		//Check if this is a request for the list of connected clients
		if(messageType == "user-list-request"){
			var currentClient = getChatClientForConnection(ws)
			var chatClientHandleList = getChatClientHandles(ws)
			var msgResponse = {
				'type' : 'user-list-response',
				'userlist' : chatClientHandleList
			}
			currentClient.sendMessage(JSON.stringify(msgResponse))
		}
		//Check if this is a request for a heroku ping
		if(messageType == "ping"){
			//Do nothing.
		}
	})

	//Send Disconnect Request
	function sendDisconnectRequest(conn,handle){
		var discoRequest = {
			'type' : 'user-disconnected',
			'handle' : handle
		}
		for(var index = 0; index < chat_clients.length; index++){
			if(chat_clients[index].connection.readyState == WebSocket.OPEN){
				chat_clients[index].sendMessage(JSON.stringify(discoRequest));
			}
		}
		removeChatClient(conn)
	}

	//When the client closes the connection
	ws.on('close', ()=>{
 		var handle = getHandleForConnection(ws)
		console.log(handle + " disconnected")
		sendDisconnectRequest(ws,handle)
	})

	//When there is an error in the connection
	ws.on('error', (err)=>{
		var handle = getHandleForConnection(ws)
		console.log("WebSocket Error for " + handle + ":" + err.message)
		sendDisconnectRequest(ws,handle)
	})
})

