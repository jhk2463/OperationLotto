//Connect box
const connectBox = document.querySelector('.connectBox');
const username = document.querySelector('#username');
const connectBtn = document.querySelector('.connectBtn');

//Sidebar
const rulesBtn = document.querySelector('.rulesBtn');
const rulesBox = document.querySelector('.rulesBox');
const nameLabel = document.querySelector('#nameLabel');
const opponent = document.querySelector('#opponent');
const exitRoomBtn = document.querySelector('.exitRoomBtn');
const createBtn = document.querySelector('.createBtn');
const gamesLabel = document.querySelector('#gamesLabel');
const gamesList = document.querySelector('.gamesList');
const joinBtn = document.querySelector('.joinBtn');

//Board
const board = document.querySelector('.board');
const myLottos = document.querySelectorAll('.myLottos .lotto');
const timer = document.querySelector('.timer span');
const countdown = document.querySelector('.countdown');

const opponentLottos = document.querySelectorAll('.opponentLottos .lotto');
const opponentCards = document.querySelectorAll('.opponentSelection #card');

const answerContainer = document.querySelector('.answerContainer');
const answerSlots = document.querySelectorAll('.answerSlot');
const resetBtn = document.querySelector('.resetBtn');
const submitBtn = document.querySelector('.submitBtn');
const answerResult = document.querySelector('.answerResult');

const selectionContainer = document.querySelector('.selectionContainer');
const myCards = document.querySelectorAll('.selectionContainer #card');
const dice = document.querySelectorAll('#die');
const exchangeLabel = document.querySelector('.exchangeLabel');
const exchangeBtn = document.querySelector('.exchangeBtn');
const passBtn = document.querySelector('.passBtn');
const bellBtn = document.querySelector('.bellBtn');

const statusBox = document.querySelector('.statusBox');

//Popup
const popup = document.querySelector('.popup');
const gameResult = document.querySelector('.gameResult');
const rematchBtn = document.querySelector('.rematchBtn');
const exitGameBtn = document.querySelector('.exitGameBtn');

//Connection Variables
var socket;
var clientId;
var gameId;

//Game Constants
const operations = ["+", "-", "x", "÷", "^", "#"];
const cardSlotIndex = [0, 2, 4, 6];
const dieSlotIndex = [1, 3, 5];
const numLotto = 4;     //Make sure it matches number in server code
const maxChances = 3;

//Game Variables
var answerSlotIndex = 0;
var rematchBool = false;
var turnBool = false; 
var passBool = false;
var correctStack = 0;
var chances = maxChances;
var prevStatus = "";

//Timer & Countdown Variables
const maxTimer = 180;
var timerIntervalID;
var timerStartTime;
const maxCountdown = 15;
var countdownIntervalID;
var countdownStartTime;



//**BUTTON HANDLING**//

//Connect client to server via websockets
connectBtn.addEventListener('click', (src) => {
    socket = new WebSocket('ws://localhost:8000');
    socket.onmessage = onMessage;
    connectBox.style.display="none";    //Hides connect prompt
});

//Send a request to create a game room
createBtn.addEventListener('click', () => {
    socket.send(JSON.stringify({
        'tag': 'create',
        'clientId': clientId,
        'username': username.value
    }));
});

//Send a request to connect to a room
joinBtn.addEventListener('click', () => {
    socket.send(JSON.stringify({
        'tag': 'join',
        'clientId': clientId,
        'username': username.value,
        'gameId': gameId
    }))
});

var close = false;
//Open and close rules
rulesBtn.addEventListener('click', () => {
    if(!close) {
        rulesBox.style.visibility = 'visible';
        close = true;
    } else {
        rulesBox.style.visibility = 'hidden';
        close = false;
    }
});

//Exchange the card the player clicks on
exchangeBtn.addEventListener('click', () => {
    prevStatus = statusBox.innerHTML;
    statusBox.innerHTML = "Choose a card you want to exchange";
    myCards.forEach(card => {
        card.classList.add('correct');  //Add green background to cards for focus
        card.removeEventListener('click', cardClicked);
        card.addEventListener('click', exchangeCard);
    });
});

//Reroll dice when BOTH players agree to pass
passBtn.addEventListener('click', () => {
    if(passBool == false){
        console.log('1st')
        //First player to click on button
        statusBox.innerHTML = "Waiting for opponent to agree to pass";
        socket.send(JSON.stringify({    //Let other player know
            'tag': 'pass',
            'clientId': clientId,
            'gameId': gameId
        }));
    } else {
        console.log('2nd')
        //Second player to click on button
        passBool = false; //Reset passBool
        newRound();
    }
});

//Allow player to attempt at an answer
bellBtn.addEventListener('click', () => {
    startCountdown();
    statusBox.innerHTML = "You have 15 seconds to submit an answer";
    enableAnswerContainer();
    disableButtons(bellBtn);
    disableButtons(passBtn);
    //Allow player to make selections
    myCards.forEach(card => {
        card.addEventListener('click', cardClicked);
    });
    dice.forEach(die => {
        die.addEventListener('click', dieClicked);
    });
    //Let other player know
    socket.send(JSON.stringify({
        'tag': 'bell',
        'clientId': clientId,
        'gameId': gameId
    }));
    //Reset passBool for cases where first player wants to pass, but second player does not and submits an answer
    passBool = false;
});

//Resets card and dice selections made by player
resetBtn.addEventListener('click', () => {
    resetAnswerSlots();
    //Let other player know
    socket.send(JSON.stringify({
        'tag': 'resetAnswer',
        'clientId': clientId,
        'gameId': gameId
    }));
});

//Handle expression submitted by player
submitBtn.addEventListener('click', () => {
    //Stop countdown
    clearInterval(countdownIntervalID);
    //Prevent player from making further selections
    myCards.forEach(card => {
        card.removeEventListener('click', cardClicked);
    });
    dice.forEach(die => {
        die.removeEventListener('click', dieClicked);
    });

    //Array of 2 strings for cases with the "*" operation
    var answerStr = ["", ""];
    var index = 0;
    //Convert submitted cards and dice into a string
    answerSlots.forEach(slot => {
        if (slot.innerText == "x") {
            answerStr[index] = answerStr[index] + "*";
        } else if (slot.innerText == "÷") {
            answerStr[index] = answerStr[index] + "/";
        } else if (slot.innerText == "^") {
            answerStr[index] = answerStr[index] + "**";
        } else if (slot.innerText == "#") {
            index++;
        } else {
            answerStr[index] = answerStr[index] + slot.innerText;
        }
    });
    //Evaluate expression 
    var answer = "";
    if (index > 0) {
        answer = answer + eval(answerStr[0]) + eval(answerStr[1]);
    } else {
        answer = eval(answerStr[0]);
    }
    //Check if answer matches one of the lotto numbers
    var correct = false;
    myLottos.forEach(lotto => {
        if (lotto.innerText == answer) {
            correctStack++;
            correct = true;
            lotto.classList.add('correct');
        }
    });
    if(correct) { //Animate correct answer and rerolls dice
        animateCorrect(answer);
        if(correctStack < numLotto) {
            setTimeout(newRound, 3000);
        }
    } else {
        animateIncorrect(answer);   //Animate incorrect answer
        if(turnBool == false) {     //First player to submit
            switchTurn();
        } else {                    //Second player to submit
            turnBool = false;
            setTimeout(newRound, 3000);
        }
    }

    //Let other player know what answer was submitted
    socket.send(JSON.stringify({
        'tag': 'opponentLotto',
        'clientId': clientId,
        'gameId': gameId,
        'answer': answer
    }));

    //End game when a player has made all of the lotto numbers
    if(correctStack >= numLotto) {
        popup.style.display='flex';
        gameResult.innerText = 'You Won!'
        clearInterval(timerIntervalID);
        disableButtons(bellBtn);
        disableButtons(passBtn);
        disableButtons(submitBtn);
        disableButtons(resetBtn);
        socket.send(JSON.stringify({    //Let other player know
            'tag': 'endGame',
            'clientId': clientId,
            'gameId': gameId
        }));
    }
});

//For exit room button on sidebar
exitRoomBtn.addEventListener('click', () => {
    exit();
});

//For exit game button on popup
exitGameBtn.addEventListener('click', () => {
    exit();
});

function exit() {
    resetGame();
    exitRoomBtn.style.display='none';
    opponent.style.display="none";
    board.style.visibility='hidden';
    countdown.style.display="none";
    statusBox.style.visibility="hidden"; 
    popup.style.display='none';
    enableSideBar(); 
    if(exitRoomBtn.disabled == true) { //Let other player know opponent has left
        socket.send(JSON.stringify({
            'tag': 'exit',
            'gameId': gameId,
            'clientId': clientId
        }));
    }  
    gameId = 0; //Reset gameId
}

//Event listener for clicking on 'Rematch' button
rematchBtn.addEventListener('click', () => {
    if (rematchBool == false) {     //First player clicks on button
        socket.send(JSON.stringify({
            'tag': 'rematch',
            'gameId': gameId,
            'clientId': clientId
        }));
        countdown.style.display="none";
        chances = maxChances;
        exchangeLabel.innerHTML = "Chances: " + chances;
        enableButtons(exchangeBtn);
        correctStack = 0;
        resetLottoVisual();
        dealCards();
        statusBox.innerText = 'Waiting for opponent response...';
        popup.style.display='none';
    }  
    else {                         //Second player agrees to rematch
        resetGame();
        enableButtons(exchangeBtn);
        exchangeLabel.innerHTML = "Chances: " + chances;
        popup.style.display='none';
    }
});

//**MESSAGE HANDLING**//

//Process messages received from server
function onMessage(msg) {
    const data = JSON.parse(msg.data); 

    switch(data.tag){

        //Successfully connected to server
        case 'connected': 
            clientId = data.clientId;    //Create local copy of clientId sent from server
            nameLabel.innerHTML = `Name: ${username.value}`;
            break;

        //Update list of available games
        case 'gamesList':
            const games = data.list
            //Completely remove existing list to avoid duplicates
            while(gamesList.firstChild){ 
                gamesList.removeChild(gamesList.lastChild);
            }
            //Replace with new list sent from server
            for(var game in games){
                const li = document.createElement('li');
                li.innerText = games[game];
                li.style.textAlign = 'center';
                gamesList.appendChild(li);
                li.addEventListener('click', () => {
                    gameId = game;
                    li.classList.add('select');
                }) //Store last list item clicked on as client's 'gameId'
            }
            break;
        
        //Player alone in created game room
        case 'created':
            gameId = data.gameId;   //Create local copy of gameId sent from server
            disableSideBar();
            exitRoomBtn.style.display="block";
            statusBox.style.visibility="visible"; 
            break;
        
        //Player joins and game starts
        case 'joined':
            disableSideBar();
            exitRoomBtn.style.display="block";
            disableButtons(exitRoomBtn);
            opponent.style.display="flex";
            opponent.innerText = "You are playing against " + data.opponent + ".";
            
            board.style.visibility="visible";
            disableAnswerContainer();
            statusBox.style.visibility="visible";
            statusBox.innerHTML = "Round Start!";
            
            dealCards();
            break;
        
        //Update lotto numbers and dice sent by server each round
        case 'updateBoard':
            for(i=0; i<numLotto; i++) {
                myLottos[i].innerHTML = data.lotto[i];
                opponentLottos[i].innerHTML = data.lotto[i];
            }
            for(i=0; i<3; i++) {
                dice[i].innerHTML = data.dice[i];
                animateCard(dice[i]);
            }
            console.log('why')
            startTimer(); 
            resetAnswerSlots();
            disableAnswerContainer();
            enableSelectionContainer();
            statusBox.innerHTML = "Hit the bell to submit an answer";
            break;
        
        //Let second player know first player wants to pass and reroll dice
        case 'pass':
            statusBox.innerHTML = "Opponent wants to pass and reroll the dice";
            passBool = true;
            break;
        
        //Prevent second player from making selections while first player is going
        case 'bell':
            disableSelectionContainer();
            break;     
        
        //For second player when first player makes an incorrect attempt
        case 'turn':
            resetAnswerSlots();
            statusBox.innerHTML = "You have the remaining time to submit an answer";
            passBool = true;
            turnBool = true;
            enableAnswerContainer();
            enableSelectionContainer();
            disableButtons(bellBtn);
            //Allow player to make selections
            myCards.forEach(card => {
                card.addEventListener('click', cardClicked);
            });
            dice.forEach(die => {
                die.addEventListener('click', dieClicked);
            });
            break; 
        
        //Update & animate display to show if opponent got it correct
        case 'opponentLotto':
            var correct = false;
            opponentLottos.forEach(lotto => {
                if (lotto.innerText == data.answer) {
                    lotto.classList.add('correct');
                    correct = true;
                    animateCorrect(data.answer);
                }
            });
            if(!correct){
                animateIncorrect(data.answer);
            }
            break;
        
        //Update display to show opponent's deck
        case 'opponentCards':
            //Update opponent display to show their deck
            for(i=0; i<8; i++) {
                opponentCards[i].innerHTML = data.cards[i];
            }
            break;
        
        //Update display to show opponent's selections live
        case 'opponentSelections':
            answerSlots[answerSlotIndex].innerHTML = data.selection;
            answerSlots[answerSlotIndex].classList.remove('answerSlot');
            answerSlots[answerSlotIndex].classList.add('deck');
            answerSlotIndex++;
            break;

        //Update display when opponent resets their selections
        case 'resetAnswer':
            resetAnswerSlots();
            break;
        
        //Show popup when opponent has won
        case 'endGame':
            popup.style.display='flex';
            gameResult.innerText = 'You Lost!'
            clearInterval(timerIntervalID);
            disableButtons(bellBtn);
            disableButtons(passBtn);
            disableButtons(submitBtn);
            disableButtons(resetBtn);
            break;
        
        //Notify player to exit room when opponent has exited
        case 'exit':
            statusBox.innerText = 'Opponent has exited the room. Please exit the room to continue playing!';
            enableButtons(exitRoomBtn);
            popup.style.display='none';
            break;

        //Notify player that opponent wants a rematch
        case 'rematch':
            statusBox.innerText = 'Opponent wants a rematch!';
            rematchBool = true;
            break;
    }
}



//**HELPER FUNCTIONS**//

//Deal initial 8 cards
function dealCards() {
    var cards = [0, 0, 0, 0, 0, 0, 0, 0];
    for(i=0; i<8; i++) {
        myCards[i].innerHTML = Math.ceil(Math.random() * 6);
        animateCard(myCards[i]);
        cards[i] = myCards[i].innerHTML;
    }

    //Let other player know what card their opponent has
    socket.send(JSON.stringify({
        'tag': 'opponentCards',
        'clientId': clientId,
        'gameId': gameId,
        'cards': cards
    }));
}

//Replace the 4 used cards when player submits a correct answer
function replaceCards() {
    var cards = [0, 0, 0, 0, 0, 0, 0, 0];
    for(i=0; i<8; i++) {
        if(myCards[i].classList.contains('answerSlot')) {
            myCards[i].innerHTML = Math.ceil(Math.random() * 6);
            animateCard(myCards[i]);
        }
        cards[i] = myCards[i].innerHTML;
    }
    //Let other player know what card their opponent has
    socket.send(JSON.stringify({
        'tag': 'opponentCards',
        'clientId': clientId,
        'gameId': gameId,
        'cards': cards
    }));
}

//Exchange a card
function exchangeCard(src) {
    //Randomly deals new card
    src.target.innerHTML = Math.ceil(Math.random() * 6);
    //Updates cards
    var cards = [0, 0, 0, 0, 0, 0, 0, 0];
    for(i=0; i<8; i++) {
        cards[i] = myCards[i].innerHTML;
    }
    //Let other player know what card their opponent has
    socket.send(JSON.stringify({  
        'tag': 'opponentCards',
        'clientId': clientId,
        'gameId': gameId,
        'cards': cards
    }));
    
    //Add animation to exchanged card
    animateCard(src.target);
    
    //Puts cards and status back into the state they previously were
    myCards.forEach(card => {
        card.classList.remove('correct');
        card.removeEventListener('click', exchangeCard);
        if(turnBool == true) {
            card.addEventListener('click', cardClicked);
        }
    });
    statusBox.innerHTML = prevStatus;

    //Keeps track of number of chances left and updates 
    chances--;
    exchangeLabel.innerHTML = "Chances: " + chances;
    if(chances == 0) {
        disableButtons(exchangeBtn);
    }
}

//Helper functions to allow player to make selections for answer attempt
function cardClicked(src) {
    if(cardSlotIndex.includes(answerSlotIndex)) {   //Check if current slot is for a card
        answerSlots[answerSlotIndex].innerHTML = src.target.innerHTML;
        answerSlots[answerSlotIndex].classList.remove('answerSlot');
        answerSlots[answerSlotIndex].classList.add('deck');
        src.target.classList.remove('deck');
        src.target.classList.add('answerSlot');
        answerSlotIndex++;
        socket.send(JSON.stringify({    //Let other player know
            'tag': 'opponentSelections',
            'clientId': clientId,
            'gameId': gameId,
            'selection': src.target.innerHTML
        }));
    }
}
function dieClicked(src) {
    if(dieSlotIndex.includes(answerSlotIndex)) {    //Check if current slot is for a die
        answerSlots[answerSlotIndex].innerHTML = src.target.innerHTML;
        answerSlots[answerSlotIndex].classList.remove('answerSlot');
        answerSlots[answerSlotIndex].classList.add('deck');
        src.target.classList.remove('deck');
        src.target.classList.add('answerSlot');
        answerSlotIndex++;
        socket.send(JSON.stringify({    //Let other player know
            'tag': 'opponentSelections',
            'clientId': clientId,
            'gameId': gameId,
            'selection': src.target.innerHTML
        }));
    }
}

//Roll dice, replace used cards if valid, and reset answer slots for new round
function newRound() {
    countdown.style.display="none";
    socket.send(JSON.stringify({
        'tag': 'rollDice',
        'gameId': gameId
    }));
    replaceCards();
    resetAnswerSlots();
}

//Switch turn to other player
function switchTurn() {
    countdown.style.display="none";
    disableAnswerContainer();
    disableSelectionContainer();
    resetAnswerSlots();
    socket.send(JSON.stringify({    //Let other player know
        'tag': 'turn',
        'clientId': clientId,
        'gameId': gameId
    }));
}

//Reset card and dice selection visuals
function resetAnswerSlots() {
    answerSlotIndex = 0;
    answerSlots.forEach(slot => {
        slot.classList.add('answerSlot');
        slot.classList.remove('deck');
    });
    myCards.forEach(card => {
        card.classList.remove('answerSlot');
        card.classList.add('deck');
    });
    dice.forEach(die => {
        die.classList.remove('answerSlot');
        die.classList.add('deck');
    });
}

//Remove color from lotto numbers
function resetLottoVisual() {
    myLottos.forEach(lotto => {
        lotto.classList.remove('correct');
    });
    opponentLottos.forEach(lotto => {
        lotto.classList.remove('correct');
    });
}

//Function to reroll lottos and dice for a new game
function resetGame() {
    socket.send(JSON.stringify({
        'tag': 'resetGame',
        'gameId': gameId
    }));
    countdown.style.display="none";
    chances = maxChances;
    correctStack = 0;
    rematchBool = false;
    enableButtons(exchangeBtn);
    resetLottoVisual();
    dealCards();
}

//Functions to disable/enable buttons
function disableButtons(button) {
    button.disabled = true;
    button.classList.add('grey-out');
}
function enableButtons(button) {
    button.disabled = false;
    button.classList.remove('grey-out');
}

//Groups of buttons enabled and disabled together
function enableSideBar() {
    enableButtons(createBtn);
    enableButtons(joinBtn);
    enableButtons(gamesLabel);
}
function disableSideBar() {
    disableButtons(createBtn);
    disableButtons(joinBtn);
    disableButtons(gamesLabel);
}
function enableAnswerContainer() {
    enableButtons(answerContainer);
    enableButtons(submitBtn);
    enableButtons(resetBtn);
}
function disableAnswerContainer() {
    disableButtons(answerContainer);
    disableButtons(submitBtn);
    disableButtons(resetBtn);
}
function enableSelectionContainer() {
    enableButtons(selectionContainer);
    enableButtons(bellBtn);
    enableButtons(passBtn);
}
function disableSelectionContainer() {
    statusBox.innerHTML = "Opponent is attempting an answer";
    disableButtons(selectionContainer);
    disableButtons(bellBtn);
    disableButtons(passBtn);
}

//Animate correct and incorrect submissions
function animateCorrect(answer) {
    answerResult.innerText = answer
    answerResult.classList.add('correct');
    answerResult.classList.remove('incorrect');
    answerResult.classList.remove('answerResultAnimate');
    answerResult.classList.add('answerResultAnimate');
    setTimeout(function(){answerResult.classList.remove('answerResultAnimate');}, 4000);
}
function animateIncorrect(answer) {
    answerResult.innerText = answer
    answerResult.classList.remove('correct');
    answerResult.classList.add('incorrect');
    answerResult.classList.remove('answerResultAnimate');
    answerResult.classList.add('answerResultAnimate');
    setTimeout(function(){answerResult.classList.remove('answerResultAnimate');}, 4000);
}

//Animate cards and dice appearing
function animateCard(target) {
    target.classList.add('animateCard');
    setTimeout(function(){target.classList.remove('animateCard');}, 1000);
}
        
// Timer Function
function startTimer() {
    clearInterval(timerIntervalID);  
    timer.innerText = maxTimer;
    timerStartTime = new Date();
    timerIntervalID = setInterval(() => {
        timer.innerText = getTimerTime()
        if (timer.innerText == 0) {
            clearInterval(timerIntervalID);     //Stop timer once it reaches 0
            newRound();                         //Move onto next round  
        }
    }, 1000);
}
function getTimerTime() {
    return Math.ceil(maxTimer - (new Date() - timerStartTime) / 1000);     // Calculate time left, convert to seconds, round to integer
}

// Countdown Function
function startCountdown() {
    countdown.style.display="flex";
    clearInterval(countdownIntervalID);  
    countdown.innerText = maxCountdown;
    countdownStartTime = new Date();
    countdownIntervalID = setInterval(() => {
        countdown.innerText = getCountdownTime()
        if (countdown.innerText == 0) {
            clearInterval(countdownIntervalID);    //Stop countdown once it reaches 0
            switchTurn();                          //Turn goes over to other player
        }
    }, 1000);
}
function getCountdownTime() {
    return Math.ceil(maxCountdown - (new Date() - countdownStartTime) / 1000);     // Calculate time left, convert to seconds, round to integer
}