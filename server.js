const fastify = require('fastify')({ logger: true });
const axios = require('axios');
const formData = require('form-data');
const fs = require('fs');
const multipart = require('@fastify/multipart');

fastify.register(multipart);
const walrusUrl = 'https://publisher.walrus-testnet.walrus.space/v1/blobs';
const walrusAggregator = 'https://aggregator.walrus-testnet.walrus.space/v1/blobs/';
const epoch = '5';



function validateWalrusAddress(address) {
    return address && /^0x[0-9a-f]{64}$/i.test(address);
}

async function getFileChunks(uploadedFile) {
    const chunks = [];
    uploadedFile.on('data', (chunk) => chunks.push(chunk));
    await new Promise((resolve) => uploadedFile.on('end', resolve));
    return chunks;
}

function createFormData(chunks) {
    const form = new formData();
    form.append('file', Buffer.concat(chunks), {
        filename: 'upload.jpg',
        contentType: 'image/jpeg'
    });
    return form;
}

async function uploadToWalrus(form, walrusUploadAddress) {
    return axios.put(walrusUrl, form, {
        headers: form.getHeaders(),
        params: {
            epochs: parseInt(epoch),
            send_object_to: walrusUploadAddress
        },
        maxBodyLength: Infinity
    });
}

async function handleFileUploadRequest(request, reply) {
    const { walrusUploadAddress, uploadedFile, error } = await parseUploadRequest(request);
    if (error) return reply.status(400).send({ error });

    const { testChunks, fileError } = await verifyAndReadFile(uploadedFile);
    if (fileError) return reply.status(400).send({ error: fileError });

    return processUpload(testChunks, walrusUploadAddress, reply);
}

async function parseUploadRequest(request) {
    const data = await request.file();
    const walrusUploadAddress = data.fields.walrusUploadAddress?.value;
    if (!validateWalrusAddress(walrusUploadAddress)) {
        return { error: 'Invalid/missing address' };
    }
    const uploadedFile = data.file;
    if (!uploadedFile) return { error: 'No file uploaded' };
    return { walrusUploadAddress, uploadedFile };
}

async function verifyAndReadFile(uploadedFile) {
    try {
        const testChunks = await getFileChunks(uploadedFile);
        console.log('Stream verified:', testChunks.length, 'chunks');
        return { testChunks };
    } catch {
        return { fileError: 'Error reading file stream' };
    }
}

async function processUpload(testChunks, walrusUploadAddress, reply) {
    const form = createFormData(testChunks);
    try {
        console.log('Sending to Walrus...');
        const response = await uploadToWalrus(form, walrusUploadAddress);
        const blobId = extractBlobIdFrom(response.data);
        return { blobId };
    } catch (error) {
        console.error('DEBUG:', {
            request: {
                size: form.getLengthSync(),
                headers: form.getHeaders()
            },
            error: error.response?.data || error.message
        });
        return reply.status(500).send({
            error: 'Upload rejected',
            reason: error.response?.data
        });
    }
}

fastify.post("/upload", handleFileUploadRequest);


function extractBlobIdFrom(response) {
    if (response.alreadyCertified) return response.alreadyCertified.blobId;
    return response.newlyCreated.blobObject.blobId;
}

const start = async () => {
    try {
        await fastify.listen({ port: 3000 });
        fastify.log.info(`Server listening on http://localhost:3000`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
}

start();
