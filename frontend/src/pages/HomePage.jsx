import { useState, useEffect } from 'react';

export default function HomePage() {
  // 1. Create state to store the message from the API
  const [message, setMessage] = useState('Loading...');

  // 2. Use useEffect to fetch data when the component loads
  useEffect(() => {
    // 3. Define an async function to fetch data
    const fetchData = async () => {
      try {
        // 4. Make the API call to your backend's root
        const response = await fetch('http://localhost:5001/');
        
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        // 5. Update the state with the message from the API
        setMessage(data.message);

      } catch (error) {
        console.error("Failed to fetch data:", error);
        setMessage(`Error: ${error.message}`);
      }
    };

    fetchData(); // Call the function
  }, []); // The empty array [] means this runs only ONCE

  // 6. Display the message
  return (
    <div>
      <h2>Home Page</h2>
      <h3>Message from Backend:</h3>
      <p>{message}</p>
    </div>
  );
}