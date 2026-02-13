
import fetch from 'node-fetch';

async function testCompile() {
    try {
        const response = await fetch('http://localhost:5000/api/compile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: 'public class Main { public static void main(String[] args) { System.out.println("Hello"); } }'
            })
        });

        console.log('Status:', response.status);
        const data = await response.json();
        console.log('Data:', data);
    } catch (error) {
        console.error('Fetch error:', error);
    }
}

testCompile();
