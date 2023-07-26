const requestListener = function(req, res) {
    res.end('Welcome');
}

const PORT = 8000;
const http = require('http').createServer(requestListener).listen(PORT, console.log("Listening on port " + PORT));
const WebSocket = require('websocket').server;    //Import websocket 
const wss = new WebSocket({'httpServer' : http}); //Create websocket server 

var clients = {};    //Store client connections with client id as key
var games = {};      //Store game objects with game id as key
const numLotto = 4;  //Number of lotto numbers players are trying to match
const maxLotto = 50; //The maximum integer a lotto number can be

const operations = ["+", "-", "x", "÷", "^", "#"];

//Deal with client request to connect to server
wss.on('request', (req) => {
    const conn = req.accept(null, req.origin); //Variable to store particular client connection
    const clientId = Math.round(Math.random()*10) + Math.round(Math.random()*10) + Math.round(Math.random()*10) //Create 'unique' Id for client
    
    //Store clientId and connection 
    clients[clientId] = { 
        'conn' : conn,
        'username': 'name'
    };     

    //Inform client that they are connected to server
    conn.send(JSON.stringify({
        'tag': 'connected',          
        'clientId': clientId
    }));

    sendAvailableGames();

    conn.on('message', onMessage);
});



//**MESSAGE HANDLING**/

//FProcess messages received from client
function onMessage(msg) {
    const data = JSON.parse(msg.utf8Data); //Need to use 'utf8Data' since we are on server
    
    switch(data.tag){

        //Create game for client
        case 'create': 
            const gameId = Math.round(Math.random()*10) + Math.round(Math.random()*10) + Math.round(Math.random()*10) //Create 'unique' Id for game
            
            //First player object
            const playerOne = {    
                'clientId': data.clientId,
                'username': data.username
            };

            const players = Array(playerOne);  //For two players
            const lotto = rollLotto();
            const dice = rollDice();

            //Game object
            games[gameId] = {   
                'lotto': lotto,
                'dice': dice,
                'players': players,
                'gamename': data.username + "'s Room"
            };

            //Send client the created game
            clients[data.clientId].conn.send(JSON.stringify({  
                'tag': 'created',
                'gameId': gameId,
                'gamename': data.username + "'s  Room"
            }));

            sendAvailableGames();
            break;

        //Connect second player to the game
        case 'join':
            //Second player object
            const playerTwo = {
                'clientId': data.clientId,
                'username': data.username
            }

            games[data.gameId].players.push(playerTwo);    //Assign 2nd player to game
            sendAvailableGames();   //Refresh list of available games

            //Send each client the joined game with their opponent's name
            games[data.gameId].players.forEach(function(player,index) {
                var opponent = 'name';
                if (index == 0) {
                    opponent = games[data.gameId].players[1].username;
                } else {
                    opponent = games[data.gameId].players[0].username;
                }
                clients[player.clientId].conn.send(JSON.stringify({ 
                    'tag': 'joined',
                    'gameId': data.gameId,
                    'opponent': opponent
                }));
            });
            console.log('here');
            updateBoard(data.gameId);
            break;

        //Let other player know opponent wants to pass and reroll dice
        case 'pass':
            games[data.gameId].players.forEach(player => {
                if (player.clientId != data.clientId) {     
                    clients[player.clientId].conn.send(JSON.stringify({ 
                        'tag': 'pass'
                    }));
                }
            });
            break;

        //Let other player opponent is attempting an answer
        case 'bell':
            games[data.gameId].players.forEach(player => {
                if (player.clientId != data.clientId) {     
                    clients[player.clientId].conn.send(JSON.stringify({ 
                        'tag': 'bell'
                    }));
                }
            });
            break;
        
        //Roll dice and send update to players
        case 'rollDice': 
            games[data.gameId].dice = rollDice();
            updateBoard(data.gameId);
            break;

        //Let other player know it is their turn
        case 'turn':
            games[data.gameId].players.forEach(player => {
                if (player.clientId != data.clientId) {     
                    clients[player.clientId].conn.send(JSON.stringify({ 
                        'tag': 'turn'
                    }));
                }
            });
            break;

        //Let other player know what answer was submitted
        case 'opponentLotto':
            games[data.gameId].players.forEach(player => {
                if (player.clientId != data.clientId) {     
                    clients[player.clientId].conn.send(JSON.stringify({ 
                        'tag': 'opponentLotto',
                        'answer': data.answer
                    }));
                }
            });
            break;
        
        //Let other player know what cards their opponent has
        case 'opponentCards':
            games[data.gameId].players.forEach(player => {
                if (player.clientId != data.clientId) {     
                    clients[player.clientId].conn.send(JSON.stringify({ 
                        'tag': 'opponentCards',
                        'cards': data.cards
                    }));
                }
            });
            break;

        //Let other player know what selections opponent is making live
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
        
        //Let other player that opponent reset answer selections
        case 'resetAnswer':
            games[data.gameId].players.forEach(player => {
                if (player.clientId != data.clientId) {     //Let other player opponent reset answer selections
                    clients[player.clientId].conn.send(JSON.stringify({ 
                        'tag': 'resetAnswer'
                    }));
                }
            });
        break;
        
        //Let other player now the game has ended
        case 'endGame':
            games[data.gameId].players.forEach(player => {
                if (player.clientId != data.clientId) {    
                    clients[player.clientId].conn.send(JSON.stringify({ 
                        'tag': 'endGame'
                    }));
                }
            });
            break;
        
        //Let other player know that opponent has exited
        case 'exit':
            games[data.gameId].players.forEach(player => {
                if (player.clientId != data.clientId) {     
                    clients[player.clientId].conn.send(JSON.stringify({ 
                        'tag': 'exit'
                    }));
                }
            });
            delete games[data.gameId];
            sendAvailableGames();
            break;

        //Let other player know that opponent wants a rematch
        case 'rematch':
            games[data.gameId].players.forEach(player => {
                if (player.clientId != data.clientId) {     
                    clients[player.clientId].conn.send(JSON.stringify({ 
                        'tag': 'rematch'
                    }));
                }
            });
            break;

        //Rolls new lottos and dice and updates clients
        case 'resetGame':
            games[data.gameId].lotto = rollLotto();
            games[data.gameId].dice = rollDice();
            updateBoard(data.gameId);
            break;
    }
}



//**HELPER FUNCTIONS**/

//Send list of available games to each client
function sendAvailableGames() {     
    const availableGames = {}; //Store game id of available games
    //Find games that have only 1 player             
    for(const game in games) {
        if(games[game].players.length<2){
            availableGames[game] = games[game].gamename;
        }
    }
    //Send to every client connected to server
    for(const client in clients) {
        clients[client].conn.send(JSON.stringify({
            'tag': 'gamesList',
            'list': availableGames
        }));
    }
}

//Send updated lotto and dice to both players
function updateBoard(gameId) {
    games[gameId].players.forEach(player => {
        clients[player.clientId].conn.send(JSON.stringify({
            'tag': 'updateBoard',
            'lotto': games[gameId].lotto,
            'dice': games[gameId].dice
        }));
    });
}

//Roll lotto numbers
function rollLotto() {
    var lotto = new Array(numLotto);
    for (let i=0; i<numLotto; i++) {
        let num = 0;
        do {
            num = Math.ceil(Math.random() * maxLotto);
        } while(lotto.includes(num));
        lotto[i] = num;
    }
    return lotto;
}

//Roll dice
function rollDice() {
    var dice = ["", "", ""];
    for (let i=0; i<3; i++) {
        if(dice.includes("#")) {
            dice[i] = operations[Math.floor(Math.random() * 5)];
        } else {
            dice[i] = operations[Math.floor(Math.random() * 6)];
        }
    }
    return dice;
}
