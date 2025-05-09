// script.js

// When the user submits their details on the homepage
document.getElementById("user-form").addEventListener("submit", function(event) {
  event.preventDefault();

  // Retrieve user inputs
  const height = document.getElementById("height").value;
  const weight = document.getElementById("weight").value;
  const age = document.getElementById("age").value;
  const squat = document.getElementById("squat").value;
  const bench = document.getElementById("bench").value;
  const deadlift = document.getElementById("deadlift").value;
  const workoutDays = [...document.querySelectorAll('input[name="workout-days"]:checked')].map(input => input.value);

  // Save to localStorage or send to backend
  localStorage.setItem("userDetails", JSON.stringify({ height, weight, age, squat, bench, deadlift, workoutDays }));
  window.location.href = "program.html"; // Redirect to program page
});

// On the program page, display the workout plan
window.onload = function() {
  const userDetails = JSON.parse(localStorage.getItem("userDetails"));
  
  // If user details are not found, redirect back to the homepage
  if (!userDetails) {
    window.location.href = "index.html";
    return;
  }

  // Display the calendar and workout details
  const calendarView = document.getElementById("calendar-view");
  const workoutPlan = document.getElementById("workout-plan");
  
  // Sample calendar and workout plan (you can create more advanced calendar systems)
  calendarView.innerHTML = `
    <ul>
      ${userDetails.workoutDays.map(day => `<li>${day}</li>`).join('')}
    </ul>
  `;

  workoutPlan.innerHTML = `
    <ul>
      ${userDetails.workoutDays.map(day => {
        const lift = day === "monday" ? "Squat" : day === "wednesday" ? "Deadlift" : "Bench Press";
        return `<li>${day}: ${lift} - ${userDetails[lift.toLowerCase()]} lbs</li>`;
      }).join('')}
    </ul>
  `;
};

// Function to complete the workout
document.getElementById("complete-workout-btn").addEventListener("click", function() {
  // Logic to mark the workout as completed and redirect to progress page
  window.location.href = "progress.html";
});
