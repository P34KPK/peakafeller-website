// Standalone Custom Cursor Logic
// isolated to ensure it runs even if other scripts fail

(function () {
    console.log('Initializing Custom Cursor (Standalone)...');

    const getCursor = () => document.getElementById('cursor');
    const getBorder = () => document.getElementById('cursor-border');

    // Create elements immediately
    let cursor = getCursor();
    let cursorBorder = getBorder();

    if (!cursor) {
        cursor = document.createElement('div');
        cursor.id = 'cursor';
        document.body.appendChild(cursor);
    }

    if (!cursorBorder) {
        cursorBorder = document.createElement('div');
        cursorBorder.id = 'cursor-border';
        document.body.appendChild(cursorBorder);
    }

    // Critical Styles
    const style = document.createElement('style');
    style.innerHTML = `
        * { cursor: none !important; }
        
        #cursor {
            position: fixed;
            top: 0; left: 0;
            width: 8px; height: 8px;
            background-color: #ff6600;
            border-radius: 50%;
            pointer-events: none;
            z-index: 2147483647; /* Max Z-Index */
            transform: translate(-50%, -50%);
            transition: width 0.2s, height 0.2s, background-color 0.2s;
        }
        
        #cursor-border {
            position: fixed;
            top: 0; left: 0;
            width: 30px; height: 30px;
            border: 1px solid #ff6600;
            border-radius: 50%;
            pointer-events: none;
            z-index: 2147483646;
            transform: translate(-50%, -50%);
            transition: top 0.05s, left 0.05s, width 0.2s, height 0.2s, border-color 0.2s;
        }

        body.hovering #cursor { width: 40px; height: 40px; background: transparent; }
        body.hovering #cursor-border { width: 50px; height: 50px; background: rgba(255,102,0,0.1); }
    `;
    document.head.appendChild(style);

    // Mouse Movement
    document.addEventListener('mousemove', (e) => {
        if (!cursor) cursor = getCursor();
        if (!cursorBorder) cursorBorder = getBorder();

        if (cursor) {
            cursor.style.left = e.clientX + 'px';
            cursor.style.top = e.clientY + 'px';
        }

        if (cursorBorder) {
            // Slight delay/drag for the border
            setTimeout(() => {
                cursorBorder.style.left = e.clientX + 'px';
                cursorBorder.style.top = e.clientY + 'px';
            }, 50);
        }

        // Hover Check
        const target = e.target;
        if (target.matches('a, button, input, textarea, select, .clickable') || target.closest('a, button')) {
            document.body.classList.add('hovering');
        } else {
            document.body.classList.remove('hovering');
        }
    });

    // Stability Observer
    const observer = new MutationObserver(() => {
        if (!document.body.contains(getCursor())) document.body.appendChild(cursor);
        if (!document.body.contains(getBorder())) document.body.appendChild(cursorBorder);
    });
    observer.observe(document.body, { childList: true });

})();
