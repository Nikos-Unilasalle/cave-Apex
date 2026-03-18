const url = 'https://vrfmghmdwbsadgovljoc.supabase.co/rest/v1/items?select=*'\;
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZyZm1naG1kd2JzYWRnb3Zsam9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MjM5MDUsImV4cCI6MjA4OTM5OTkwNX0.P-7nx1l0C-pGjJTMUOdeeYH-MQ1WNtz1_Ed6F0mqkWA';

fetch(url, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } })
  .then(res => res.json())
  .then(data => console.log('ITEMS:', JSON.stringify(data)))
  .catch(err => console.error(err));

const url2 = 'https://vrfmghmdwbsadgovljoc.supabase.co/rest/v1/categories?select=*'\;
fetch(url2, { headers: { 'apikey': key, 'Authorization': 'Bearer ' + key } })
  .then(res => res.json())
  .then(data => console.log('CAT:', JSON.stringify(data)))
  .catch(err => console.error(err));
