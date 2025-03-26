/**
 * PNG Metadata Editor
 * A JavaScript module to read and write PNG metadata tags
 */

class PNGMetadata {
    constructor() {
        this.decoder = new TextDecoder('utf-8');
        this.encoder = new TextEncoder();
    }

    /**
     * Read metadata from a PNG file
     * @param {File|Blob} file - The PNG file
     * @returns {Promise<Object>} - Metadata object
     */
    async readMetadata(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const buffer = reader.result;
                    const metadata = this.extractMetadata(buffer);
                    resolve(metadata);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Extract metadata from PNG buffer
     * @param {ArrayBuffer} buffer - The PNG file buffer
     * @returns {Object} - Metadata object
     */
    extractMetadata(buffer) {
        const view = new DataView(buffer);
        const metadata = {};
        
        // Check PNG signature
        if (!this.isPNG(view)) {
            throw new Error('Not a valid PNG file');
        }
        
        // Skip PNG signature (8 bytes) and get to the chunks
        let offset = 8;
        
        while (offset < view.byteLength) {
            // Read chunk length
            const length = view.getUint32(offset, false);
            offset += 4;
            
            // Read chunk type
            const typeBytes = new Uint8Array(buffer, offset, 4);
            const chunkType = this.decoder.decode(typeBytes);
            offset += 4;
            
            // If it's a tEXt chunk, extract the metadata
            if (chunkType === 'tEXt') {
                const chunkData = new Uint8Array(buffer, offset, length);
                const nullIndex = chunkData.indexOf(0);
                
                if (nullIndex !== -1) {
                    const keyBytes = chunkData.slice(0, nullIndex);
                    const valueBytes = chunkData.slice(nullIndex + 1);
                    
                    const key = this.decoder.decode(keyBytes);
                    const value = this.decoder.decode(valueBytes);
                    
                    metadata[key] = value;
                }
            }
            
            // Move to the next chunk (skip data + CRC)
            offset += length + 4;
        }
        
        return metadata;
    }

    /**
     * Write metadata to a PNG file
     * @param {File|Blob} file - The PNG file
     * @param {Object} metadata - Key-value pairs of metadata
     * @returns {Promise<Blob>} - New PNG file with metadata
     */
    async writeMetadata(file, metadata) {
        // For PDF files, we can't add PNG metadata
        if (file.type === 'application/pdf') {
            throw new Error('Cannot add PNG metadata to PDF files. Please convert to PNG first.');
        }
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const buffer = reader.result;
                    
                    // Verify it's a valid PNG file
                    const view = new DataView(buffer);
                    if (!this.isPNG(view)) {
                        throw new Error('The selected file is not a valid PNG image');
                    }
                    
                    const newPNG = this.injectMetadata(buffer, metadata);
                    resolve(new Blob([newPNG], { type: 'image/png' }));
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * Inject metadata into PNG buffer
     * @param {ArrayBuffer} buffer - The PNG file buffer
     * @param {Object} metadata - Key-value pairs of metadata
     * @returns {ArrayBuffer} - New PNG buffer with metadata
     */
    injectMetadata(buffer, metadata) {
        const originalData = new Uint8Array(buffer);
        
        // Check for existing metadata chunks to remove
        const { chunks, idatIndex } = this.analyzeChunks(buffer);
        
        if (idatIndex === -1) {
            throw new Error('Invalid PNG structure: no IDAT chunk found');
        }
        
        // Create tEXt chunks for metadata
        const metadataChunks = Object.entries(metadata)
            .filter(([key, value]) => key && value) // Filter out empty entries
            .map(([key, value]) => this.createTextChunk(key, value));
        
        // Calculate the total size for new file
        let newSize = 8; // PNG signature
        
        // Add size of chunks before IDAT (excluding any existing tEXt chunks)
        for (let i = 0; i < idatIndex; i++) {
            if (chunks[i].type !== 'tEXt') {
                newSize += chunks[i].length;
            }
        }
        
        // Add size of new metadata chunks
        for (const chunk of metadataChunks) {
            newSize += chunk.length;
        }
        
        // Add size of IDAT and remaining chunks
        for (let i = idatIndex; i < chunks.length; i++) {
            newSize += chunks[i].length;
        }
        
        // Create new buffer with proper size
        const newBuffer = new ArrayBuffer(newSize);
        const newView = new Uint8Array(newBuffer);
        
        // Copy PNG signature (first 8 bytes)
        newView.set(originalData.subarray(0, 8), 0);
        let writeOffset = 8;
        
        // Copy chunks before IDAT (excluding any existing tEXt chunks)
        for (let i = 0; i < idatIndex; i++) {
            if (chunks[i].type !== 'tEXt') {
                const startOffset = chunks[i].offset;
                const length = chunks[i].length;
                newView.set(originalData.subarray(startOffset, startOffset + length), writeOffset);
                writeOffset += length;
            }
        }
        
        // Insert new metadata chunks
        for (const chunk of metadataChunks) {
            newView.set(chunk, writeOffset);
            writeOffset += chunk.length;
        }
        
        // Copy IDAT and remaining chunks
        for (let i = idatIndex; i < chunks.length; i++) {
            const startOffset = chunks[i].offset;
            const length = chunks[i].length;
            newView.set(originalData.subarray(startOffset, startOffset + length), writeOffset);
            writeOffset += length;
        }
        
        return newBuffer;
    }

    /**
     * Analyze PNG chunks
     * @param {ArrayBuffer} buffer - The PNG file buffer
     * @returns {Object} - Information about chunks
     */
    analyzeChunks(buffer) {
        const view = new DataView(buffer);
        const chunks = [];
        let idatIndex = -1;
        
        // Skip PNG signature (8 bytes)
        let offset = 8;
        
        let index = 0;
        while (offset < view.byteLength) {
            const chunkStart = offset;
            
            // Read chunk length
            const length = view.getUint32(offset, false);
            offset += 4;
            
            // Read chunk type
            const typeBytes = new Uint8Array(buffer, offset, 4);
            const type = this.decoder.decode(typeBytes);
            offset += 4;
            
            // Skip data
            offset += length;
            
            // Skip CRC
            offset += 4;
            
            chunks.push({
                index,
                type,
                offset: chunkStart,
                length: offset - chunkStart
            });
            
            if (type === 'IDAT' && idatIndex === -1) {
                idatIndex = index;
            }
            
            // IEND chunk means end of PNG
            if (type === 'IEND') {
                break;
            }
            
            index++;
        }
        
        return { chunks, idatIndex };
    }

    /**
     * Create a tEXt chunk from key and value
     * @param {string} key - Metadata key
     * @param {string} value - Metadata value
     * @returns {Uint8Array} - tEXt chunk
     */
    createTextChunk(key, value) {
        // Encode key and value
        const keyBytes = this.encoder.encode(key);
        const valueBytes = this.encoder.encode(value);
        
        // Length of data (key + null separator + value)
        const length = keyBytes.length + 1 + valueBytes.length;
        
        // Create buffer for chunk (length + type + data + CRC)
        const chunk = new Uint8Array(4 + 4 + length + 4);
        const view = new DataView(chunk.buffer);
        
        // Write length
        view.setUint32(0, length, false);
        
        // Write type ('tEXt')
        chunk[4] = 116; // t
        chunk[5] = 69;  // E
        chunk[6] = 88;  // X
        chunk[7] = 116; // t
        
        // Write data
        let offset = 8;
        
        // Write key
        chunk.set(keyBytes, offset);
        offset += keyBytes.length;
        
        // Write null separator
        chunk[offset] = 0;
        offset += 1;
        
        // Write value
        chunk.set(valueBytes, offset);
        offset += valueBytes.length;
        
        // Calculate and write CRC
        const crc = this.calculateCRC(chunk.subarray(4, 8 + length));
        view.setUint32(8 + length, crc, false);
        
        return chunk;
    }

    /**
     * Split PNG file into chunks
     * @param {ArrayBuffer} buffer - The PNG file buffer
     * @returns {Array} - Array of chunk objects
     */
    splitIntoChunks(buffer) {
        const { chunks } = this.analyzeChunks(buffer);
        return chunks;
    }

    /**
     * Check if buffer is a valid PNG
     * @param {DataView} view - DataView of the buffer
     * @returns {boolean} - true if valid PNG
     */
    isPNG(view) {
        if (view.byteLength < 8) return false;
        
        return (
            view.getUint8(0) === 137 &&
            view.getUint8(1) === 80 &&
            view.getUint8(2) === 78 &&
            view.getUint8(3) === 71 &&
            view.getUint8(4) === 13 &&
            view.getUint8(5) === 10 &&
            view.getUint8(6) === 26 &&
            view.getUint8(7) === 10
        );
    }

    /**
     * Calculate CRC for chunk
     * @param {Uint8Array} data - Chunk data (type + data)
     * @returns {number} - CRC value
     */
    calculateCRC(data) {
        let crc = -1;
        const crcTable = this.getCRCTable();
        
        for (let i = 0; i < data.length; i++) {
            crc = crcTable[(crc ^ data[i]) & 0xff] ^ ((crc >> 8) & 0x00ffffff);
        }
        
        return crc ^ -1;
    }

    /**
     * Get CRC table for PNG chunks
     * @returns {Uint32Array} - CRC table
     */
    getCRCTable() {
        if (this.crcTable) return this.crcTable;
        
        this.crcTable = new Uint32Array(256);
        
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let j = 0; j < 8; j++) {
                c = ((c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1);
            }
            this.crcTable[i] = c;
        }
        
        return this.crcTable;
    }

    /**
     * Get common PNG metadata keys
     * @returns {Array} - Array of common metadata keys
     */
    getCommonKeys() {
        return [
            'Title',
            'Author',
            'Description',
            'Copyright',
            'Creation Time',
            'Software',
            'Disclaimer',
            'Warning',
            'Source',
            'Comment',
            'Keywords'
        ];
    }
}

// Export the class
window.PNGMetadata = PNGMetadata; 