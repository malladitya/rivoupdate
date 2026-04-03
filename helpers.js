// User-friendly helper functions
function reportCurrentLocation(type) {
  if (!navigator.geolocation) {
    alert('❌ Location not supported by your browser');
    return;
  }
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const coords = [position.coords.longitude, position.coords.latitude];
      console.log('Location:', coords);
      
      if (type === 'noise') {
        reportNoiseZone(coords, 0.9, 'User reported noise');
        alert('✅ Thank you! Noise report submitted at your location.');
      } else if (type === 'crowd') {
        reportCrowdedArea(coords, 0.8, 'User reported crowd');
        alert('✅ Thank you! Crowd report submitted at your location.');
      }
    },
    (error) => {
      console.error('Location error:', error);
      if (error.code === 1) {
        alert('❌ Please allow location access in your browser settings');
      } else if (error.code === 2) {
        alert('❌ Location unavailable. Please try again.');
      } else {
        alert('❌ Location timeout. Please try again.');
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

function checkComfort() {
  if (!navigator.geolocation) {
    const comfort = comfortAI.predict([77.4538, 28.6692], Date.now());
    const percentage = (comfort * 100).toFixed(0);
    alert(`😊 Comfort Level: ${percentage}%`);
    return;
  }
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const coords = [position.coords.longitude, position.coords.latitude];
      console.log('Checking comfort at:', coords);
      const comfort = comfortAI.predict(coords, Date.now());
      const percentage = (comfort * 100).toFixed(0);
      let emoji = '😊';
      let message = 'Great!';
      if (comfort < 0.3) { emoji = '😰'; message = 'High stress'; }
      else if (comfort < 0.6) { emoji = '😐'; message = 'Moderate'; }
      alert(`${emoji} Comfort Level: ${percentage}%\n${message}`);
    },
    (error) => {
      console.error('Location error:', error);
      const comfort = comfortAI.predict([77.4538, 28.6692], Date.now());
      const percentage = (comfort * 100).toFixed(0);
      alert(`😊 Comfort Level: ${percentage}%\n(Using default location)`);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}
