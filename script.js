async function uploadCV() {
    const input = document.getElementById('cvInput');
 
    const file = input.files[0];

    if (!file) {
        alert("Please upload a file");
        return;
    }

    const fileType = file.name.split('.').pop().toLowerCase();

    let extractedText = '';
    try{
        if (fileType === 'pdf') {
            extractedText = await extractTextFromPDF(file);
        } else if (fileType === 'docx') {
            extractedText = await extractTextFromDocx(file);
        } else {
            alert("Unsupported file type");
            return;
        }
    }

    catch (err) {
        let message = '';
    
        if (err === 'OCR PDF detected. Text extraction is not supported.') {
            message = "This is an **OCR PDF**, and we cannot extract text from it.";
        } else {
            message = `Error: ${err.message || "An error occurred while processing the file."}`;
        }
        clearPreviousResponse();
        showMessageInBox("Error", message, "red");
    
     
        input.value = '';
        const fileNameDisplay = document.getElementById('fileName');
        fileNameDisplay.innerText = '';
       

        return;
    }
    

    console.log("Extracted Text:", extractedText);

 
    const ip = await getClientIP();  

    const rateLimitStatus = await checkRateLimit(ip); 

    if (rateLimitStatus === 'Limit Reached. Try again later.') {
        alert("Limit reached! You have exceeded the number of allowed requests.");
        return;
    }
    clearPreviousResponse();

    const responseContainer = document.getElementById('responseContainer');
    const skeletonLoader = document.getElementById('skeletonLoader');

    if (skeletonLoader) {
        skeletonLoader.style.display = 'flex'; // Show the loader
    }
    if (responseContainer) {
        responseContainer.style.display = 'block'; // Show the response container
    }
    sendToAPI(extractedText, ip);
}

function showErrorMessage(message) {
    const responseContainer = document.getElementById('responseContainer');
    const errorMessageContainer = document.createElement("div");
    errorMessageContainer.className = "error-message";
    // errorMessageContainer.innerHTML = `<h3>Error</h3><p>${message}</p>`;

    responseContainer.appendChild(errorMessageContainer);

    // Hide the loader
    const skeletonLoader = document.getElementById('skeletonLoader');
    if (skeletonLoader) {
        skeletonLoader.style.display = 'none';
    }
}

function clearPreviousResponse() {
    const responseContainer = document.getElementById('responseContainer');
    const skeletonLoader = document.getElementById('skeletonLoader');

    if (!responseContainer) return;
    Array.from(responseContainer.children).forEach(child => {
        if (child !== skeletonLoader && child) {
            child.remove();
        }
    });


    
    if (skeletonLoader) {
        skeletonLoader.style.display = 'none';
    }
    
}




async function getClientIP() {

    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
}

// async function checkRateLimit(ip) {
//     const response = await fetch(`/api/checkRateLimit?ip=${ip}`);
//     const message = await response.text();
//     return message;  
// }

async function checkRateLimit(ip) {
    try {
      const response = await fetch(`http://ec2-54-242-82-0.compute-1.amazonaws.com:8080/api/checkRateLimit?ip=${ip}`);
      const message = await response.text();
  
      if (message === "Limit Reached. Try again later.") {
        alert("You have reached the maximum number of tries.");
      }
  
      return message;
    } catch (error) {
      console.error("Error checking rate limit:", error);
    }
  }
  


async function extractTextFromPDF(file) {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
        reader.onload = async function () {
            const typedArray = new Uint8Array(this.result);
            const pdf = await pdfjsLib.getDocument(typedArray).promise;
            let text = '';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                const strings = content.items.map(item => item.str);
                text += strings.join(' ') + '\n';
            }
            if (text.trim().length === 0 || text.trim().replace(/\s+/g, '').length < 20) {
                reject('OCR PDF detected. Text extraction is not supported.');
            } else {
                resolve(text);
            }
        };
        reader.readAsArrayBuffer(file);
    });
}




async function extractTextFromDocx(file) {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
        reader.onload = function () {
            const arrayBuffer = reader.result;
            mammoth.extractRawText({ arrayBuffer: arrayBuffer })
                .then(result => resolve(result.value))
                .catch(err => {
                    console.error("Error extracting text from DOCX:", err);
                    reject("Error extracting text from DOCX.");
                });
        };
        reader.readAsArrayBuffer(file);
    });
}

async function sendToAPI(text, ip) {
    const payload = { text: text, ip: ip };

    const responseContainer = document.getElementById('responseContainer');
    const skeletonLoader = document.getElementById('skeletonLoader');

    // Show the spinner

 
    if (skeletonLoader) {
        skeletonLoader.style.display = 'flex';
    }
    if (responseContainer) {
        responseContainer.style.display = 'block';
    }

   

    try {
        const response = await fetch("http://ec2-54-242-82-0.compute-1.amazonaws.com:8080/api/gemini", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "ip-address": ip
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const contentType = response.headers.get("content-type");
        let data;

        if (contentType && contentType.includes("application/json")) {
            data = await response.json();
        } else {
            const textData = await response.text();
            console.warn("Response is not JSON, treating as plain text:", textData);
            if (textData === "Limit exceeded for today") {
                alert("Limit exceeded for today. Please try again tomorrow.");
                return;  
            }
            data = { message: textData };  
        }


        console.log("API Response:", data);
        showResponse(data);
    } catch (err) {
        console.error("Error:", err);
        if (skeletonLoader) {
            skeletonLoader.style.display = 'none';
        }
        responseContainer.style.display = 'block'; // Ensure the response box is visible
        responseContainer.innerHTML = `<div class="card"><h3>Error Occurred</h3><p>Something went wrong while processing your request. Please try again later.</p></div>`;
    }
    finally {
       
        if (skeletonLoader) {
            skeletonLoader.style.display = 'none';
        }
    }
}

function showResponse(data) {
  
    if (data.message) {
        showMessageInBox("Message", data.message);
    }


}

function showMessageInBox(title, message, color = "#fff") {
    const container = document.getElementById("responseContainer");
    const skeletonLoader = document.getElementById("skeletonLoader");

    if (skeletonLoader) {
        skeletonLoader.style.display = 'none';
    }

    if (!container) {
        console.error("Response container not found in the DOM.");
        return;
    }

    container.style.display = 'block';
    // container.innerHTML = ''; 

    const renderedHTML = marked.parse(message);

    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
        <h3 style="color: ${color};">${title}</h3>
        <p>${renderedHTML}</p>
    `;
    container.appendChild(card);
}



const uploadArea = document.getElementById('uploadArea');
const cvInput = document.getElementById('cvInput');
const fileNameDisplay = document.getElementById('fileName');

// Click to open file dialog
uploadArea.addEventListener('click', () => {
  cvInput.click();
});

// Drag over effect
uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.style.background = 'rgba(255, 255, 255, 0.3)';
});

// Drag leave effect
uploadArea.addEventListener('dragleave', (e) => {
  e.preventDefault();
  uploadArea.style.background = 'rgba(255, 255, 255, 0.1)';
});

// Drop file
uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.style.background = 'rgba(255, 255, 255, 0.1)';
  const file = e.dataTransfer.files[0];
  if (file) {
    cvInput.files = e.dataTransfer.files;
    fileNameDisplay.innerText = `Selected: ${file.name}`;
  }
});

// Show file name when selected normally
cvInput.addEventListener('change', () => {
  if (cvInput.files[0]) {
    fileNameDisplay.innerText = `Selected: ${cvInput.files[0].name}`;
  }
});
