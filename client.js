const connectBox = document.querySelector('.connectBox');
const username = document.querySelector('#username');
const connectBtn = document.querySelector('.connectBtn');
const nameLabel = document.querySelector('#nameLabel');
const opponent = document.querySelector('#opponent');
const exitRoomBtn = document.querySelector('.exitRoomBtn');
const createBtn = document.querySelector('.createBtn');
const gamesLabel = document.querySelector('#gamesLabel');
const gamesList = document.querySelector('.gamesList');
const joinBtn = document.querySelector('.joinBtn');

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
const passBtn = document.querySelector('.passBtn');
const bellBtn = document.querySelector('.bellBtn');

const statusBox = document.querySelector('.statusBox');
const popup = document.querySelector('.popup');
const rematchBtn = document.querySelector('.rematchBtn');
const exitGameBtn = document.querySelector('.exitGameBtn');

var socket;
var clientId;
var gameId;
var rematchBool = 0;
var incorrectStack = 0;
var passStack = 0;
var correctStack = 0;
var rematchBool = 0;
const operations = ["+", "-", "x", "÷", "^", "*"];
var answerSlotIndex = 0;
const cardSlotIndex = [0, 2, 4, 6];
const dieSlotIndex = [1, 3, 5];

const maxTimer = 180;
let timerIntervalID;
let timerStartTime;

const maxCountdown = 15;
let countdownIntervalID;
let countdownStartTime;

//**BUTTON HANDLING**//

//Event listener for clicking on 'Connect' button
connectBtn.addEventListener('click', (src) => {    //Click connect button to connect to server
    socket = new WebSocket('ws://localhost:8000');
    socket.onmessage = onMessage;
    connectBox.style.display="none";    //Hides connect prompt 
    console.log(username.value);
});

//Event listener for clicking on 'Create' button
createBtn.addEventListener('click', () => {
    socket.send(JSON.stringify({
        'tag': 'create',
        'clientId': clientId,
        'username': username.value
    }));
});

//Event listener for clicking on 'Join' button
joinBtn.addEventListener('click', () => {
    socket.send(JSON.stringify({
        'tag': 'join',
        'clientId': clientId,
        'username': username.value,
        'gameId': gameId
    }))
});

//Event listener for clicking on 'Pass' button
passBtn.addEventListener('click', () => {
    if(passStack == 0){
        console.log('pass 1');
        statusBox.innerHTML = "Waiting for opponent to agree to pass";
        socket.send(JSON.stringify({
            'tag': 'pass',
            'clientId': clientId,
            'gameId': gameId
        }));
    } else {
        passStack = 0;
        reroll();
    }
});

//Event listener for clicking on 'Bell' button
bellBtn.addEventListener('click', () => {
    enableAnswerContainer();
    startCountdown();
    disableButtons(bellBtn);
    disableButtons(passBtn);
    socket.send(JSON.stringify({
        'tag': 'bell',
        'clientId': clientId,
        'gameId': gameId
    }));
    makeSelections();
    statusBox.innerHTML = "You have 15 seconds to submit an answer";
    passStack = 0;
});

//Event listener for clicking on 'Reset' button
resetBtn.addEventListener('click', () => {
    reset();
});

//Event listener for clicking on 'Submit' button
submitBtn.addEventListener('click', () => {
    var answerStr = ["", ""];
    var index = 0;
    answerSlots.forEach(slot => {
        if (slot.innerText == "x") {
            answerStr[index] = answerStr[index] + "*";
        } else if (slot.innerText == "÷") {
            answerStr[index] = answerStr[index] + "/";
        } else if (slot.innerText == "^") {
            answerStr[index] = answerStr[index] + "**";
        } else if (slot.innerText == "*") {
            index++;
        } else {
            answerStr[index] = answerStr[index] + slot.innerText;
        }
    });
    var answer = "";
    if (index > 0) {
        answer = answer + eval(answerStr[0]) + eval(answerStr[1]);
    } else {
        answer = eval(answerStr[0]);
    }
    
    var correct = false;
    myLottos.forEach(lotto => {
        if (lotto.innerText == answer) {
            correctStack++;
            correct = true;
            lotto.classList.add('correct');
        }
    });
    
    socket.send(JSON.stringify({
        'tag': 'opponentLotto',
        'clientId': clientId,
        'gameId': gameId,
        'answer': answer
    }));

    clearInterval(countdownIntervalID);
    if(correct) {
        animateCorrect(answer);
        if(correctStack < 2) {
            setTimeout(reroll, 3000);
        }
    } else {
        animateIncorrect(answer);
        if(incorrectStack == 0) {
            switchTurn();
        } else {
            incorrectStack = 0;
            setTimeout(reroll, 3000);
        }
    }

    if(correctStack >= 2) {
        console.log('end');
        popup.style.display='flex';
        clearInterval(timerIntervalID);
        disableButtons(bellBtn);
        disableButtons(passBtn);
        disableButtons(submitBtn);
        disableButtons(resetBtn);
        socket.send(JSON.stringify({
            'tag': 'endGame',
            'clientId': clientId,
            'gameId': gameId
        }));
    }

    myCards.forEach(card => {
        card.removeEventListener('click', cardClicked);
    });
    dice.forEach(die => {
        die.removeEventListener('click', dieClicked);
    });
});

//Event listener for clicking on 'Exit Room' button
exitRoomBtn.addEventListener('click', () => {
    console.log('exitRoom');
    exit();
});

//Event listener for clicking on 'Exit Game' button
exitGameBtn.addEventListener('click', () => {
    console.log('exitGame');
    exit();
});

//Event listener for clicking on 'Rematch' button
rematchBtn.addEventListener('click', () => {
    console.log('rematch');
    rematch();
});



//**MESSAGE HANDLING**//

//Function to process message received from server
function onMessage(msg) {
    const data = JSON.parse(msg.data); 
    switch(data.tag){
        case 'connected': 
            clientId = data.clientId;    //Create local copy of clientId sent from server
            nameLabel.innerHTML = `Name: ${username.value}`;
            break;

        case 'gamesList':
            const games = data.list
            //Remove existing list and replace with new list sent from server to avoid duplicates
            while(gamesList.firstChild){ 
                gamesList.removeChild(gamesList.lastChild);
            }
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

        case 'created':
            gameId = data.gameId;
            disableButtons(createBtn);
            disableButtons(joinBtn);
            disableButtons(gamesLabel);
            statusBox.style.visibility="visible"; 
            exitRoomBtn.style.display="block";
            break;

        case 'joined':
            board.style.visibility="visible";
            opponent.style.display="flex";
            opponent.innerText = "You are playing against " + data.opponent + ".";
            disableButtons(createBtn);
            disableButtons(joinBtn);
            disableButtons(gamesLabel);
            disableButtons(exitRoomBtn);
            disableAnswerContainer();
            statusBox.style.visibility="visible";
            statusBox.innerHTML = "Round Start!";
            exitRoomBtn.style.display="block";
            dealCards();
            break;
        
        case 'updateBoard':
            //Loop through lotto sent by server and update on client
            for(i=0; i<2; i++) {
                myLottos[i].innerHTML = data.lotto[i];
                opponentLottos[i].innerHTML = data.lotto[i];
            }

            //Loop through dice sent by server and update on client
            for(i=0; i<3; i++) {
                dice[i].innerHTML = data.dice[i];
            }
            statusBox.innerHTML = "Hit the bell to submit an answer";
            startTimer(); 
            reset();
            disableAnswerContainer();
            enableSelectionContainer();
            enableButtons(bellBtn);
            enableButtons(passBtn);
            break;

        case 'pass':
            console.log('pass 3');
            statusBox.innerHTML = "Opponent wants to pass and reroll the dice";
            passStack++;
            break;
        
        case 'bell':
            disableSelectionContainer();
            break;     

        case 'turn':
            statusBox.innerHTML = "You have the remaining time to submit an answer";
            passStack++;
            incorrectStack++;
            enableAnswerContainer();
            enableSelectionContainer();
            disableButtons(bellBtn);
            reset();
            makeSelections();
            break; 
        
        case 'opponentLotto':
            //Update opponent display to show if they got correct
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

        case 'opponentCards':
            //Update opponent display to show their deck
            for(i=0; i<8; i++) {
                opponentCards[i].innerHTML = data.cards[i];
            }
            break;

        case 'opponentSelections':
            answerSlots[answerSlotIndex].innerHTML = data.selection;
            answerSlots[answerSlotIndex].classList.remove('answerSlot');
            answerSlots[answerSlotIndex].classList.add('deck');
            answerSlotIndex++;
            break;

        case 'endGame':
            popup.style.display='flex';
            clearInterval(timerIntervalID);
            disableButtons(bellBtn);
            disableButtons(passBtn);
            disableButtons(submitBtn);
            disableButtons(resetBtn);
            break;

        case 'exit':
            statusBox.innerText = 'Opponent has exited the room. Please exit the room to continue playing!';
            enableButtons(exitRoomBtn);
            popup.style.display='none';
            break;

        case 'rematch':
            rematchBool = 1;
            statusBox.innerText = 'Opponent wants a rematch!';
            break;
    }
}


//**HELPER FUNCTIONS**//

//Function to deal initial 8 cards
function dealCards() {
    var cards = [0, 0, 0, 0, 0, 0, 0, 0];
    for(i=0; i<8; i++) {
        myCards[i].innerHTML = Math.ceil(Math.random() * 6);
        cards[i] = myCards[i].innerHTML;
    }
    socket.send(JSON.stringify({
        'tag': 'opponentCards',
        'clientId': clientId,
        'gameId': gameId,
        'cards': cards
    }));
}

//Function to replace the 4 used cards
function replaceCards() {
    var cards = [0, 0, 0, 0, 0, 0, 0, 0];
    for(i=0; i<8; i++) {
        if(myCards[i].classList.contains('answerSlot')) {
            myCards[i].innerHTML = Math.ceil(Math.random() * 6);
        }
        cards[i] = myCards[i].innerHTML;
    }
    socket.send(JSON.stringify({
        'tag': 'opponentCards',
        'clientId': clientId,
        'gameId': gameId,
        'cards': cards
    }));
}

//Functions to allow making selections for answer attempt
function makeSelections() {
    myCards.forEach(card => {
        card.addEventListener('click', cardClicked);
    });
    dice.forEach(die => {
        die.addEventListener('click', dieClicked);
    });
}
function cardClicked(src) {
    if(cardSlotIndex.includes(answerSlotIndex)) {
        answerSlots[answerSlotIndex].innerHTML = src.target.innerHTML;
        answerSlots[answerSlotIndex].classList.remove('answerSlot');
        answerSlots[answerSlotIndex].classList.add('deck');
        src.target.classList.remove('deck');
        src.target.classList.add('answerSlot');
        answerSlotIndex++;
        socket.send(JSON.stringify({
            'tag': 'opponentSelections',
            'clientId': clientId,
            'gameId': gameId,
            'selection': src.target.innerHTML
        }));
    }
}
function dieClicked(src) {
    if(dieSlotIndex.includes(answerSlotIndex)) {
        answerSlots[answerSlotIndex].innerHTML = src.target.innerHTML;
        answerSlots[answerSlotIndex].classList.remove('answerSlot');
        answerSlots[answerSlotIndex].classList.add('deck');
        src.target.classList.remove('deck');
        src.target.classList.add('answerSlot');
        answerSlotIndex++;
        socket.send(JSON.stringify({
            'tag': 'opponentSelections',
            'clientId': clientId,
            'gameId': gameId,
            'selection': src.target.innerHTML
        }));
    }
}

//Function to reroll dice
function reroll() {
    socket.send(JSON.stringify({
        'tag': 'roll',
        'gameId': gameId
    }));
    countdown.style.display="none";
    replaceCards();
    reset();
}

//Function to switch turn to other player
function switchTurn() {
    socket.send(JSON.stringify({
        'tag': 'turn',
        'clientId': clientId,
        'gameId': gameId
    }));
    countdown.style.display="none";
    disableAnswerContainer();
    disableSelectionContainer();
    reset();
}

//Function to reset board  visuals
function reset() {
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

//Functions to disable/enable buttons
function disableButtons(button) {
    button.disabled = true;
    button.classList.add('grey-out');
}
function enableButtons(button) {
    button.disabled = false;
    button.classList.remove('grey-out');
}

//Functions to animate correct and incorrect submissions
function animateCorrect(answer) {
    console.log("correct");
    answerResult.innerText = answer
    answerResult.classList.add('correct');
    answerResult.classList.remove('incorrect');
    answerResult.classList.remove('answerResultAnimate');
    answerResult.classList.add('answerResultAnimate');
    setTimeout(function(){answerResult.classList.remove('answerResultAnimate');}, 4000);
}
function animateIncorrect(answer) {
    console.log("incorrect");
    answerResult.innerText = answer
    answerResult.classList.remove('correct');
    answerResult.classList.add('incorrect');
    answerResult.classList.remove('answerResultAnimate');
    answerResult.classList.add('answerResultAnimate');
    setTimeout(function(){answerResult.classList.remove('answerResultAnimate');}, 4000);
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
            reroll();                           //Move onto next round  
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
            console.log('done')
            clearInterval(countdownIntervalID);    //Stop countdown once it reaches 0
            switchTurn();                          //Turn goes over to other player
        }
    }, 1000);
}
function getCountdownTime() {
    return Math.ceil(maxCountdown - (new Date() - countdownStartTime) / 1000);     // Calculate time left, convert to seconds, round to integer
}

function exit() {
    document.querySelector('.board').style.display='none';
    statusBox.style.display="none"; 
    popup.style.display='none';
    exitRoomBtn.style.display='none';
    enableButtons(createBtn);
    enableButtons(joinBtn);
    if(exitRoomBtn.disabled == true)
    socket.send(JSON.stringify({
        'tag': 'exit',
        'gameId': gameId,
        'clientId': clientId
    }));
    gameId = 0;
}

function rematch() {
    if (rematchBool == 0) {
        socket.send(JSON.stringify({
            'tag': 'rematch',
            'gameId': gameId,
            'clientId': clientId
        }));
        statusBox.innerText = 'Waiting for opponent response...';
        popup.style.display='none';
    }
    else {
        reroll();
        rematchBool = 0;
        popup.style.display='none';
    }
}
