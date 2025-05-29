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
    const ohp = document.getElementById("ohp").value;
    const startDate = document.getElementById("startDate").value; // Retrieve start date

    // Parse numeric values
    const parsedHeight = parseFloat(height);
    const parsedWeight = parseFloat(weight);
    const parsedAge = parseFloat(age);
    const parsedSquat = parseFloat(squat);
    const parsedBench = parseFloat(bench);
    const parsedDeadlift = parseFloat(deadlift);
    const parsedOhp = parseFloat(ohp);

    const workoutDays = [...document.querySelectorAll('input[name="workout-days"]:checked')].map(input => input.value);

    // Client-side validation
    if (!height || !weight || !age || !squat || !bench || !deadlift || !ohp || !startDate || // Added startDate to validation
        isNaN(parsedHeight) || isNaN(parsedWeight) || isNaN(parsedAge) ||
        isNaN(parsedSquat) || isNaN(parsedBench) || isNaN(parsedDeadlift) || isNaN(parsedOhp) ||
        workoutDays.length === 0) {
      alert("Please fill in all fields, select workout day(s), provide a valid start date, and ensure height, weight, age, and all lift inputs are valid numbers."); // Updated alert
      return;
    }

    // Save the user's details to localStorage
    localStorage.setItem("userDetails", JSON.stringify({
      height, weight, age, squat, bench, deadlift, ohp, startDate, workoutDays // Added startDate to localStorage
    }));

    // Redirect to the program page
    window.location.href = "program.html";
  });
}

// Helper function to format a Date object to "YYYY-MM-DD"
function formatDate(dateObj) {
  const year = dateObj.getFullYear();
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const day = dateObj.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const liftRotation = ["Squat", "Bench Press", "Overhead Press", "Deadlift"];
const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const liftToUserDetailsKey = {
  "Squat": "squat",
  "Bench Press": "bench",
  "Overhead Press": "ohp",
  "Deadlift": "deadlift"
};

// Helper function to find the next uncompleted workout
function findNextUncompletedWorkout(scheduledWorkouts, progressHistory) {
  if (!progressHistory || progressHistory.length === 0) {
    return scheduledWorkouts.length > 0 ? scheduledWorkouts[0] : null;
  }
  for (const scheduledWorkout of scheduledWorkouts) {
    const isCompleted = progressHistory.some(
      progressRecord => progressRecord.date === scheduledWorkout.date &&
                        progressRecord.liftName === scheduledWorkout.liftName
    );
    if (!isCompleted) {
      return scheduledWorkout;
    }
  }
  return null; // All scheduled workouts are completed
}

function initProgramPage() {
  console.log("Program page script loading");
  const workoutPlanDiv = document.getElementById("workout-plan");
  if (!workoutPlanDiv) {
    console.error("workout-plan div not found!");
    return;
  }
  workoutPlanDiv.innerHTML = ""; // Clear previous content

  const userDetailsString = localStorage.getItem("userDetails");
  if (!userDetailsString) {
    workoutPlanDiv.innerHTML = "<p>User details not found. Please complete setup on the main page.</p>";
    return;
  }

  let userDetails;
  try {
    userDetails = JSON.parse(userDetailsString);
  } catch (error) {
    console.error("Error parsing userDetails from localStorage:", error);
    workoutPlanDiv.innerHTML = "<p>There was an error loading your workout data. Please try setting up again.</p>";
    return;
  }

  const { startDate: startDateString, workoutDays } = userDetails;

  if (!startDateString || !workoutDays || workoutDays.length === 0) {
    workoutPlanDiv.innerHTML = "<p>Program start date or workout days not set. Please complete setup on the <a href='index.html'>main page</a>.</p>";
    return;
  }

  const scheduledWorkouts = [];
  let currentDate = new Date(startDateString + 'T00:00:00'); // Ensure local time interpretation
  let currentLiftIndex = 0;
  let wendlerCycleWeek = 1; // Tracks Wendler week 1, 2, or 3
  let workoutsScheduledForCurrentWendlerWeek = 0;
  let safetyBreak = 0; // To prevent infinite loops

  while (scheduledWorkouts.length < 12 && safetyBreak < 365) { // Schedule 12 workouts (4 lifts x 3 weeks)
    const dayName = dayNames[currentDate.getDay()];

    if (workoutDays.includes(dayName)) {
      const liftName = liftRotation[currentLiftIndex % liftRotation.length];
      const userDetailsKey = liftToUserDetailsKey[liftName];
      const oneRepMax = userDetails[userDetailsKey];

      if (oneRepMax === undefined || oneRepMax === null || oneRepMax === "") {
         // If 1RM for a lift is missing from userDetails, skip scheduling it for now or handle error
         // For simplicity, we'll skip this specific workout slot and try to schedule the next lift
         // This means the schedule might be unbalanced if 1RMs are missing.
         console.warn(`1RM for ${liftName} is missing in userDetails. Skipping this workout slot.`);
      } else {
        scheduledWorkouts.push({
          date: formatDate(currentDate),
          liftName: liftName,
          wendlerWeek: wendlerCycleWeek,
          oneRepMax: oneRepMax
        });
        currentLiftIndex++;
        workoutsScheduledForCurrentWendlerWeek++;

        if (workoutsScheduledForCurrentWendlerWeek === liftRotation.length) {
          wendlerCycleWeek++;
          workoutsScheduledForCurrentWendlerWeek = 0;
        }
      }
    }
    currentDate.setDate(currentDate.getDate() + 1);
    safetyBreak++;
  }
  
  if (safetyBreak >= 365 && scheduledWorkouts.length < 12) {
    workoutPlanDiv.innerHTML += "<p style='color:red;'>Could not generate a full 12-workout schedule within a year. Please check your start date and selected workout days.</p>";
  }


  if (scheduledWorkouts.length === 0) {
    workoutPlanDiv.innerHTML = "<p>No workouts could be scheduled. Please check your setup (start date and selected workout days).</p>";
    return;
  }

  // Display Scheduled Workouts & Visual Indication of Completion
  const progressHistoryForDisplay = JSON.parse(localStorage.getItem("wendlerProgressHistory")) || [];
  scheduledWorkouts.forEach(workout => {
    const workoutTitle = document.createElement("h3");
    let titleText = `${workout.date} - ${workout.liftName} (Wendler Week ${workout.wendlerWeek})`;

    const isCompleted = progressHistoryForDisplay.some(
      record => record.date === workout.date && record.liftName === workout.liftName
    );

    if (isCompleted) {
      titleText += " (Completed)";
      workoutTitle.style.textDecoration = "line-through";
      workoutTitle.style.color = "grey";
    }
    workoutTitle.textContent = titleText;
    workoutPlanDiv.appendChild(workoutTitle);

    const parsedOneRepMax = parseFloat(workout.oneRepMax);
    if (isNaN(parsedOneRepMax)) {
      const errorPara = document.createElement("p");
      errorPara.innerHTML = `Invalid numeric data for ${workout.liftName} (value: '${workout.oneRepMax}'). Please update on the <a href="index.html">Setup page</a>.`;
      errorPara.style.color = "red";
      workoutPlanDiv.appendChild(errorPara);
      return; // Skips this workout's sets display
    }

    const trainingMax = calculateTrainingMax(parsedOneRepMax);
    const weekSets = calculateWendlerWeek(trainingMax, workout.wendlerWeek);

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
      noSetsPara.textContent = `Could not calculate sets for ${workout.liftName}.`;
      workoutPlanDiv.appendChild(noSetsPara);
    }
  });


  // --- Workout Completion Logic ---
  const completeWorkoutButton = document.getElementById("complete-workout-btn");
  if (completeWorkoutButton) {
    const currentProgressHistory = JSON.parse(localStorage.getItem("wendlerProgressHistory")) || [];
    const nextWorkoutToComplete = findNextUncompletedWorkout(scheduledWorkouts, currentProgressHistory);

    if (nextWorkoutToComplete) {
      completeWorkoutButton.textContent = `Mark "${nextWorkoutToComplete.liftName} on ${nextWorkoutToComplete.date}" Complete`;
      completeWorkoutButton.disabled = false;
    } else {
      completeWorkoutButton.textContent = "All Workouts Done!";
      completeWorkoutButton.disabled = true;
    }

    // Clone and replace the button to remove old event listeners
    const newButton = completeWorkoutButton.cloneNode(true);
    completeWorkoutButton.parentNode.replaceChild(newButton, completeWorkoutButton);
    
    newButton.addEventListener("click", function handleCompleteClick() {
      // Re-fetch history and next workout inside listener to ensure it's current
      const latestProgressHistory = JSON.parse(localStorage.getItem("wendlerProgressHistory")) || [];
      const workoutToMark = findNextUncompletedWorkout(scheduledWorkouts, latestProgressHistory);

      if (workoutToMark) {
        const progressRecord = {
          date: workoutToMark.date,
          liftName: workoutToMark.liftName,
          wendlerWeek: workoutToMark.wendlerWeek,
          oneRepMax: workoutToMark.oneRepMax,
          completedDate: new Date().toISOString().split('T')[0]
        };

        latestProgressHistory.push(progressRecord);
        localStorage.setItem("wendlerProgressHistory", JSON.stringify(latestProgressHistory));
        alert(`Workout for ${workoutToMark.liftName} on ${workoutToMark.date} marked complete!`);
        initProgramPage(); // Refresh the display
      } else {
        alert("All scheduled workouts completed!");
        newButton.textContent = "All Workouts Done!";
        newButton.disabled = true;
      }
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
