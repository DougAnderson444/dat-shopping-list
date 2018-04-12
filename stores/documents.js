module.exports = store

function store (state, emitter) {
  state.documents = []

  openDocumentsDB(() => { emitter.emit('render') })

  emitter.on('writeNewDocumentRecord', (keyHex, docName) => {
    writeDocumentRecord(keyHex, docName, err => {
      if (err) throw err
      emitter.emit('pushState', `/doc/${keyHex}`)
    })
  })

  // Store documents in indexedDB
  function openDocumentsDB (cb) {
    const request = window.indexedDB.open('documents', 2)
    request.onerror = function (event) {
      console.log('IndexedDB error')
    }
    request.onsuccess = function (event) {
      state.documentsDB = event.target.result
      readDocuments(cb)
    }
    request.onupgradeneeded = function (event) {
      const db = event.target.result
      let objectStore
      if (event.oldVersion === 0) {
        objectStore = db.createObjectStore('documents', {keyPath: 'key'})
        objectStore.createIndex('name', 'name')
      } else {
        objectStore = event.target.transaction.objectStore('documents')
      }
      objectStore.createIndex('dateAdded', 'dateAdded')
      objectStore.transaction.oncomplete = function (event) {
        console.log('Document db created')
      }
    }
  }

  function readDocuments (cb) {
    const db = state.documentsDB
    if (!db) return
    const objectStore = db.transaction('documents').objectStore('documents')
    const index = objectStore.index('dateAdded')
    state.documents = []
    index.openCursor().onsuccess = function (event) {
      const cursor = event.target.result
      if (cursor) {
        state.documents.push(cursor.value)
        cursor.continue()
      } else {
        cb()
      } 
    }
  }

  function writeDocumentRecord (key, name, cb) {
    const db = state.documentsDB
    if (!db) return
    const request = db.transaction('documents', 'readwrite')
      .objectStore('documents')
      .add({
        key,
        name,
        dateAdded: Date.now()
      })
    request.onsuccess = function (event) {
      readDocuments(() => {
        console.log('documents reloaded')
        cb()
      })
    }
    request.onerror = function (err) {
      cb(err)
    }
  }
}
