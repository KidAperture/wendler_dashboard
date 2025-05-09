// script.js

// Wait for the DOM to be fully loaded
document.addEventListener("DOMContentLoaded", function () {

  // Add event listener to the form submission
  document.getElementById("user-form").addEventListener("submit", function (event) {
    event.preventDefault();  // Prevent form from submitting traditionally

    // Retrieve the user's input values
    const height = document.getElementById("height").value;
    const weight = document.getElementById("weight").value;
    const age = document.getElementById("age").value;
    const squat = document.getElementById("squat").value;
    const bench = document.getElementById("bench").value;
    const deadlift = document.getElementById("deadlift").value;
    const workoutDays = [...document.querySelectorAll('input[name="workout-days"]:checked')].map(input => input.value);

    // Client-side validation (check if any required field is empty)
    if (!height || !weight || !age || !squat || !bench || !deadlift || workoutDays.length === 0) {
      alert("Please fill in all fields and select at least one workout day.");
      return;
    }

    // Save the user's details to localStorage
    localStorage.setItem("userDetails", JSON.stringify({
      height, weight, age, squat, bench, deadlift, workoutDays
    }));

    // Redirect to the program page
    window.location.href = "program.html";
  });
});
