window.addEventListener("DOMContentLoaded", function () {
  const progressBar = document.querySelector(".progress-bar");
  const progressText = document.getElementById("progress-text");

  // Function to update progress bar and text
  function updateProgressBar(percentage) {
    progressBar.style.width = percentage + "%";

    // Display progress message based on percentage
    if (percentage === 100) {
      progressText.textContent = "Cycle Complete! Great job!";
      progressText.className = "complete";
    } else if (percentage > 0) {
      progressText.textContent = "Keep going! Progressing...";
      progressText.className = "in-progress";
    } else {
      progressText.textContent = "";
    }
  }

  // Example of updating the progress bar dynamically (you can adjust this value)
  let progressPercentage = 70; // This can be dynamically updated
  updateProgressBar(progressPercentage);

  // You can later use setInterval, events, or other logic to change progress dynamically
});
