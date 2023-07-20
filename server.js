const PORT = 8000;

const http = require('http').createServer().listen(PORT, '0.0.0.0', console.log("Listening on port " + PORT));
const WebSocket = require('websocket').server;    //Import websocket 
const wss = new WebSocket({'httpServer' : http}); //Create websocket server 

var clients = {};    //Store client connections with client id as key
var games = {};      //Store game objects with game id as key

const operations = ["+", "-", "x", "÷", "^", "*"];

//Dealing with client request to connect to server
wss.on('request', (req) => {
    const conn = req.accept(null, req.origin); //Variable to store particular client connection
    const clientId = Math.round(Math.random()*10) + Math.round(Math.random()*10) + Math.round(Math.random()*10) //Create 'unique' Id for client
    
    clients[clientId] = { 
        'conn' : conn,
        'username': 'name'
    };     //Store clientId and connection 
    
    conn.send(JSON.stringify({
        'tag': 'connected',          //Informing client that they are connected to server
        'clientId': clientId
    }));

    sendAvailableGames();

    conn.on('message', onMessage);
});


//**MESSAGE HANDLING**/

//Function to process message received from client
function onMessage(msg) {
    const data = JSON.parse(msg.utf8Data); //Need to use 'utf8Data' since we are on server
    switch(data.tag){
        case 'create': 
            const gameId = Math.round(Math.random()*10) + Math.round(Math.random()*10) + Math.round(Math.random()*10) //Create 'unique' Id for game

            const playerOne = {    //One player object
                'clientId': data.clientId,
                'username': data.username
            };
            const players = Array(playerOne);  //For two players
            
            const lotto = rollLotto();
            const dice = rollDice();

            games[gameId] = {   //Game object
                'lotto': lotto,
                'dice': dice,
                'players': players,
                'gamename': data.username + "'s Room"
            };
            
            clients[data.clientId].conn.send(JSON.stringify({  //Send client the created game
                'tag': 'created',
                'gameId': gameId,
                'gamename': data.username + "'s  Room"
            }));
            sendAvailableGames();
            break;

        case 'join':
            const playerTwo = {
                'clientId': data.clientId,
                'username': data.username
            }
            games[data.gameId].players.push(playerTwo);    //Assign 2nd player to game
            sendAvailableGames();   //Refresh list of available games
            games[data.gameId].players.forEach(function(player,index) {
                var opponent = 'name';
                if (index == 0) {
                    opponent = games[data.gameId].players[1].username;
                } else {
                    opponent = games[data.gameId].players[0].username;
                }
                clients[player.clientId].conn.send(JSON.stringify({ //Send client the joined game
                    'tag': 'joined',
                    'gameId': data.gameId,
                    'opponent': opponent
                }));
            });
            updateBoard(data.gameId);
            break;

        case 'pass':
            games[data.gameId].players.forEach(player => {
                if (player.clientId != data.clientId) {     //Let other player know opponent wants to pass
                    clients[player.clientId].conn.send(JSON.stringify({ 
                        'tag': 'pass'
                    }));
                }
            });
            console.log('pass 2');
            break;

        case 'bell':
            games[data.gameId].players.forEach(player => {
                if (player.clientId != data.clientId) {     //Let other player know it is opponent's turn
                    clients[player.clientId].conn.send(JSON.stringify({ 
                        'tag': 'bell'
                    }));
                }
            });
            break;

        case 'roll': 
            games[data.gameId].dice = rollDice();
            updateBoard(data.gameId);
            break;

        case 'turn':
            games[data.gameId].players.forEach(player => {
                if (player.clientId != data.clientId) {     //Let other player know it is opponent's turn
                    clients[player.clientId].conn.send(JSON.stringify({ 
                        'tag': 'turn'
                    }));
                }
            });
            break;

        case 'opponentLotto':
            games[data.gameId].players.forEach(player => {
                if (player.clientId != data.clientId) {     //Let other player know what opponent got right
                    clients[player.clientId].conn.send(JSON.stringify({ 
                        'tag': 'opponentLotto',
                        'answer': data.answer
                    }));
                }
            });
            break;
        
        case 'opponentCards':
            games[data.gameId].players.forEach(player => {
                if (player.clientId != data.clientId) {     //Let other player know what opponent got right
                    clients[player.clientId].conn.send(JSON.stringify({ 
                        'tag': 'opponentCards',
                        'cards': data.cards
                    }));
                }
            });
            break;

        case 'opponentSelections':
            games[data.gameId].players.forEach(player => {
                if (player.clientId != data.clientId) {     //Let other player know what opponent got right
                    clients[player.clientId].conn.send(JSON.stringify({ 
                        'tag': 'opponentSelections',
                        'selection': data.selection
                    }));
                }
            });
            break;

        case 'endGame':
            games[data.gameId].players.forEach(player => {
                if (player.clientId != data.clientId) {     //Let other player know opponent has made all 6 lotto numbers
                    clients[player.clientId].conn.send(JSON.stringify({ 
                        'tag': 'endGame'
                    }));
                }
            });
            break;
        
        case 'exit':
            games[data.gameId].players.forEach(player => {
                if (player.clientId != data.clientId) {     //Let other player know opponent has exited
                    clients[player.clientId].conn.send(JSON.stringify({ 
                        'tag': 'exit'
                    }));
                }
            });
            delete games[data.gameId];
            sendAvailableGames();
            break;

        case 'rematch':
            games[data.gameId].players.forEach(player => {
                if (player.clientId != data.clientId) {     //Let other player know opponent wants rematch
                    clients[player.clientId].conn.send(JSON.stringify({ 
                        'tag': 'rematch'
                    }));
                }
            });
            break;

        case 'resetGame':
            games[data.gameId].lotto = rollLotto();
            games[data.gameId].dice = rollDice();
            updateBoard(data.gameId);
    }
}


//**HELPER FUNCTIONS**/

//Function to send list of available games to each client
function sendAvailableGames() {     
    const availableGames = {}; //Store game id of available games
    //Find games that have only 1 player             
    for(const game in games) {
        if(games[game].players.length<2){
            availableGames[game] = games[game].gamename;
        }
    }
    //Send to every client connected
    for(const client in clients) {
        clients[client].conn.send(JSON.stringify({
            'tag': 'gamesList',
            'list': availableGames
        }));
    }
}

//Function to send updated board to both players
function updateBoard(gameId) {
    games[gameId].players.forEach(player => {
        clients[player.clientId].conn.send(JSON.stringify({
            'tag': 'updateBoard',
            'lotto': games[gameId].lotto,
            'dice': games[gameId].dice
        }));
    });
}

//Function to roll lotto numbers
function rollLotto() {
    var lotto = [0, 0];
    for (let i=0; i<2; i++) {
        let num = 0
        while(lotto.includes(num)) {
            num = Math.ceil(Math.random() * 50);
        } 
        lotto[i] = num;
    }
    return lotto;
}

//Function to roll dice
function rollDice() {
    var dice = ["", "", ""];
    for (let i=0; i<3; i++) {
        if(dice.includes("*")) {
            dice[i] = operations[Math.floor(Math.random() * 5)];
        } else {
            dice[i] = operations[Math.floor(Math.random() * 6)];
        }
    }
    return dice;
}
