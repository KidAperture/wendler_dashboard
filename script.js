// script.js

// Wait for the DOM to be fully loaded
// Wendler 5/3/1 Calculation Logic
function calculateTrainingMax(oneRepMax) {
  return Math.round(oneRepMax * 0.9);
}

function calculateWendlerWeek(trainingMax, weekNumber) {
  const sets = [];
  let weekPercentages = [];
  let weekReps = [];

  switch (weekNumber) {
    case 1:
      weekPercentages = [0.65, 0.75, 0.85];
      weekReps = ["5", "5", "5+"];
      break;
    case 2:
      weekPercentages = [0.70, 0.80, 0.90];
      weekReps = ["3", "3", "3+"];
      break;
    case 3:
      weekPercentages = [0.75, 0.85, 0.95];
      weekReps = ["5", "3", "1+"];
      break;
    default:
      return []; // Invalid week number
  }

  for (let i = 0; i < weekPercentages.length; i++) {
    sets.push({
      percentage: weekPercentages[i],
      reps: weekReps[i],
      weight: Math.round(trainingMax * weekPercentages[i]),
    });
  }

  return sets;
}

document.addEventListener("DOMContentLoaded", function () {
  if (document.getElementById("user-form")) {
    initIndexPage();
  } else if (document.getElementById("calendar-view") || document.getElementById("complete-workout-btn")) {
    initProgramPage();
  } else if (document.getElementById("progress-charts")) {
    initProgressPage();
  }
});

function initIndexPage() {
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
    const ohp = document.getElementById("ohp").value; // Get OHP value
    const workoutDays = [...document.querySelectorAll('input[name="workout-days"]:checked')].map(input => input.value);

    // Client-side validation (check if any required field is empty)
    if (!height || !weight || !age || !squat || !bench || !deadlift || !ohp || workoutDays.length === 0) { // Added OHP to validation
      alert("Please fill in all fields (including OHP) and select at least one workout day."); // Updated alert
      return;
    }

    // Save the user's details to localStorage
    localStorage.setItem("userDetails", JSON.stringify({
      height, weight, age, squat, bench, deadlift, ohp, workoutDays // Added OHP to localStorage
    }));

    // Redirect to the program page
    window.location.href = "program.html";
  });
}

function initProgramPage() {
  console.log("Program page script loaded");
  const workoutPlanDiv = document.getElementById("workout-plan");
  if (!workoutPlanDiv) {
    console.error("workout-plan div not found!");
    return;
  }

  const userDetailsString = localStorage.getItem("userDetails");

  if (!userDetailsString) {
    workoutPlanDiv.innerHTML = "<p>Please complete your setup on the main page.</p>";
    return;
  }

  try {
    const userDetails = JSON.parse(userDetailsString);
    workoutPlanDiv.innerHTML = ""; // Clear existing content

    const lifts = [
      { name: "Squat", oneRepMax: userDetails.squat },
      { name: "Bench Press", oneRepMax: userDetails.bench },
      { name: "Deadlift", oneRepMax: userDetails.deadlift },
      { name: "Overhead Press", oneRepMax: userDetails.ohp } // Added OHP
    ];

    const weekNumber = 1; // Displaying Week 1

    lifts.forEach(lift => {
      if (lift.oneRepMax) { // Check if the 1RM value exists
        const trainingMax = calculateTrainingMax(parseFloat(lift.oneRepMax));
        const weekSets = calculateWendlerWeek(trainingMax, weekNumber);

        const liftTitle = document.createElement("h3");
        liftTitle.textContent = `${lift.name} - Week ${weekNumber}`;
        workoutPlanDiv.appendChild(liftTitle);

        if (weekSets.length > 0) {
          const setsList = document.createElement("ul");
          weekSets.forEach((set, index) => {
            const listItem = document.createElement("li");
            listItem.textContent = `Set ${index + 1}: ${set.weight} lbs x ${set.reps} reps (${set.percentage * 100}%)`;
            setsList.appendChild(listItem);
          });
          workoutPlanDiv.appendChild(setsList);
        } else {
          const noSetsPara = document.createElement("p");
          noSetsPara.textContent = `Could not calculate sets for ${lift.name}.`;
          workoutPlanDiv.appendChild(noSetsPara);
        }
      } else {
        const noDataPara = document.createElement("p");
        noDataPara.textContent = `No one-rep max data found for ${lift.name}. Please update on the main page.`;
        workoutPlanDiv.appendChild(noDataPara);
      }
    });

  } catch (error) {
    console.error("Error parsing userDetails from localStorage:", error);
    workoutPlanDiv.innerHTML = "<p>There was an error loading your workout data. Please try setting up again.</p>";
    return; // Exit if there's an error
  }

  // --- Workout Completion Logic ---
  const completeWorkoutButton = document.getElementById("complete-workout-btn");
  if (completeWorkoutButton) {
    completeWorkoutButton.addEventListener("click", function() {
      // For now, we assume Week 1 is being completed.
      // This will be made dynamic later.
      const completedWeekRecord = {
        week: 1, // Static for now
        completedDate: new Date().toISOString().split('T')[0] // YYYY-MM-DD
      };

      let progressHistory = JSON.parse(localStorage.getItem("wendlerProgressHistory")) || [];
      progressHistory.push(completedWeekRecord);
      localStorage.setItem("wendlerProgressHistory", JSON.stringify(progressHistory));

      alert("Week 1 workout marked as complete!");
      // Optionally, disable the button or change its text
      // completeWorkoutButton.disabled = true;
      // completeWorkoutButton.textContent = "Week 1 Completed!";
    });
  } else {
    console.warn("'complete-workout-btn' not found. Completion tracking will not be active.");
  }
}

function initProgressPage() {
  console.log("Progress page script loaded");
  const progressDiv = document.getElementById("progress");

  if (!progressDiv) {
    console.error("'progress' div not found on this page.");
    return;
  }

  progressDiv.innerHTML = ""; // Clear existing content

  const progressHistoryString = localStorage.getItem("wendlerProgressHistory");
  let progressHistory = [];

  if (progressHistoryString) {
    try {
      progressHistory = JSON.parse(progressHistoryString);
    } catch (error) {
      console.error("Error parsing wendlerProgressHistory from localStorage:", error);
      progressDiv.innerHTML = "<p>Could not load progress data. It might be corrupted.</p>";
      return;
    }
  }

  if (progressHistory && progressHistory.length > 0) {
    const heading = document.createElement("h4"); // Using h4 for sub-section
    heading.textContent = "Completed Workouts:";
    progressDiv.appendChild(heading);

    const list = document.createElement("ul");
    progressHistory.forEach(record => {
      const listItem = document.createElement("li");
      listItem.textContent = `Week ${record.week} completed on ${record.completedDate}`;
      list.appendChild(listItem);
    });
    progressDiv.appendChild(list);
  } else {
    progressDiv.innerHTML = "<p>No workouts completed yet. Go crush it!</p>";
  }
}
