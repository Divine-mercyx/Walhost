const fastify = require('fastify')({ logger: true });
const multipart = require('@fastify/multipart');
const {handleFileUploadRequest, handleFileGetting} = require("./routes/route");
const dotenv = require('dotenv');
const port = process.env.PORT || 3000;

dotenv.config();
fastify.register(multipart);
fastify.post("/upload", handleFileUploadRequest);
fastify.get('/retrieve/:blobId', handleFileGetting);

const start = async () => {
    try {
        await fastify.listen({ port, host: '0.0.0.0' });
        fastify.log.info(`Server listening on http://localhost:${port}`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
}

start();
