var circle = document.getElementById("circle");
var height = document.documentElement.clientHeight;
var width = document.documentElement.clientWidth;

// create an interval to compute this every second for a certain amount of time
var intervalID = window.setInterval(moveCircle, 3000)



function moveCircle() {

    let randY = Math.floor((Math.random() * height) + 1);
    let randX = Math.floor((Math.random() * width) + 1);
    circle.style.transform = `translate(${randX}px, ${randY}px)`;
    circle.style.visibility = 'visible';

    // After 1 second, hide it again
    setTimeout(() => {
        circle.style.visibility = 'hidden';
    }, 1000); // hides after 1 second
}

