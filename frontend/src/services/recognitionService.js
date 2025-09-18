/**
 * Face Recognition Service
 * Centralized service for making requests to the face recognition API
 */

import { getRecognitionUrl, getRecognitionConfig } from '../config/api'

class RecognitionService {
  constructor() {
    this.config = getRecognitionConfig()
  }

  /**
   * Make a request to the recognition service
   * @param {string} endpoint - The endpoint to call
   * @param {Object} options - Request options
   * @returns {Promise<Response>}
   */
  async makeRequest(endpoint, options = {}) {
    const url = getRecognitionUrl(endpoint)
    const defaultOptions = {
      signal: AbortSignal.timeout(this.config.timeout),
      ...options
    }

    console.log(`Making request to ${endpoint}:`, url)
    return fetch(url, defaultOptions)
  }

  /**
   * Check if the recognition service is healthy
   * @returns {Promise<Object>}
   */
  async checkHealth() {
    try {
      const response = await this.makeRequest('health')
      const data = await response.json()
      return { success: true, data }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  /**
   * Perform simple face recognition
   * @param {File|Blob} image - Image file or blob
   * @param {string} filename - Filename for the image
   * @returns {Promise<Object>}
   */
  async recognizeSimple(image, filename = 'image.jpg') {
    try {
      const formData = new FormData()
      formData.append('image', image, filename)

      const response = await this.makeRequest('recognizeSimple', {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        }
      })

      const responseText = await response.text()
      const data = JSON.parse(responseText)
      
      return { 
        success: response.ok, 
        data, 
        status: response.status,
        error: response.ok ? null : data.message || 'Unknown error'
      }
    } catch (error) {
      console.error('Simple recognition error:', error)
      return { 
        success: false, 
        error: error.message,
        isNetworkError: error.name === 'TypeError' && error.message.includes('fetch')
      }
    }
  }

  /**
   * Perform face recognition with liveness detection
   * @param {File|Blob} image - Image file or blob
   * @param {string} filename - Filename for the image
   * @returns {Promise<Object>}
   */
  async recognize(image, filename = 'image.jpg') {
    try {
      const formData = new FormData()
      formData.append('image', image, filename)

      const response = await this.makeRequest('recognize', {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        }
      })

      const responseText = await response.text()
      const data = JSON.parse(responseText)
      
      return { 
        success: response.ok, 
        data, 
        status: response.status,
        error: response.ok ? null : data.message || 'Unknown error'
      }
    } catch (error) {
      console.error('Recognition error:', error)
      return { 
        success: false, 
        error: error.message,
        isNetworkError: error.name === 'TypeError' && error.message.includes('fetch')
      }
    }
  }

  /**
   * Perform liveness detection with multiple images
   * @param {Array<File|Blob>} images - Array of image files or blobs
   * @returns {Promise<Object>}
   */
  async checkLiveness(images) {
    try {
      const formData = new FormData()
      images.forEach((image, index) => {
        formData.append('images', image, `frame_${index}.jpg`)
      })

      const response = await this.makeRequest('livenessCheck', {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        }
      })

      const responseText = await response.text()
      const data = JSON.parse(responseText)
      
      return { 
        success: response.ok, 
        data, 
        status: response.status,
        error: response.ok ? null : data.message || 'Unknown error'
      }
    } catch (error) {
      console.error('Liveness check error:', error)
      return { 
        success: false, 
        error: error.message,
        isNetworkError: error.name === 'TypeError' && error.message.includes('fetch')
      }
    }
  }

  /**
   * Reload the face database
   * @returns {Promise<Object>}
   */
  async reloadDatabase() {
    try {
      const response = await this.makeRequest('reload', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
        }
      })

      const data = await response.json()
      
      return { 
        success: response.ok, 
        data, 
        status: response.status,
        error: response.ok ? null : data.message || 'Unknown error'
      }
    } catch (error) {
      console.error('Reload database error:', error)
      return { 
        success: false, 
        error: error.message,
        isNetworkError: error.name === 'TypeError' && error.message.includes('fetch')
      }
    }
  }
}

// Export singleton instance
export default new RecognitionService()
