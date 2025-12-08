console.log('=== BETA PAGE DEBUG ===');
console.log('Page loaded at:', new Date().toISOString());

// Check if elements exist
setTimeout(() => {
    console.log('Checking elements after 1 second...');
    console.log('publishBtn exists:', !!document.getElementById('publishBtn'));
    console.log('albumTitle exists:', !!document.getElementById('albumTitle'));
    console.log('coverUpload exists:', !!document.getElementById('coverUpload'));
    console.log('tracksUpload exists:', !!document.getElementById('tracksUpload'));

    // Try to attach a simple click handler
    const btn = document.getElementById('publishBtn');
    if (btn) {
        console.log('Attaching test click handler...');
        btn.addEventListener('click', () => {
            console.log('TEST: Button clicked!');
            alert('Button works!');
        });
    } else {
        console.error('publishBtn not found!');
    }
}, 1000);
