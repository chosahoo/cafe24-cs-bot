const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const cheerio = require('cheerio');
const db = require('../config/database');

// 파일 업로드 설정
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = process.env.UPLOAD_PATH || './uploads';
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 // 10MB
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['.pdf', '.docx', '.doc', '.txt', '.html', '.jpg', '.jpeg', '.png', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('지원하지 않는 파일 형식입니다. (PDF, DOCX, DOC, TXT, HTML, JPG, PNG, GIF만 허용)'));
    }
  }
});

// 파일 내용 추출 함수
async function extractFileContent(filePath, fileType) {
  try {
    switch (fileType) {
      case '.pdf':
        const pdfData = await fs.readFile(filePath);
        const pdfResult = await pdfParse(pdfData);
        return pdfResult.text;
      
      case '.docx':
        const docxBuffer = await fs.readFile(filePath);
        const docxResult = await mammoth.extractRawText({ buffer: docxBuffer });
        return docxResult.value;
      
      case '.doc':
        // DOC 파일은 간단한 텍스트 추출만 지원
        const docBuffer = await fs.readFile(filePath);
        return docBuffer.toString('utf8');
      
      case '.html':
        const htmlContent = await fs.readFile(filePath, 'utf8');
        const $ = cheerio.load(htmlContent);
        return $('body').text();
      
      case '.txt':
        return await fs.readFile(filePath, 'utf8');
      
      default:
        throw new Error('지원하지 않는 파일 형식입니다.');
    }
  } catch (error) {
    console.error('파일 내용 추출 오류:', error);
    throw new Error('파일 내용을 읽을 수 없습니다.');
  }
}

// 매뉴얼 목록 조회
router.get('/', async (req, res) => {
  try {
    db.all('SELECT * FROM manuals ORDER BY created_at DESC', (err, rows) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          error: '매뉴얼 목록 조회에 실패했습니다.',
          message: err.message 
        });
      }
      res.json({ success: true, data: rows });
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: '매뉴얼 목록 조회에 실패했습니다.',
      message: error.message 
    });
  }
});

// 특정 매뉴얼 조회
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    db.get('SELECT * FROM manuals WHERE id = ?', [id], (err, row) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          error: '매뉴얼 조회에 실패했습니다.',
          message: err.message 
        });
      }
      if (!row) {
        return res.status(404).json({ 
          success: false, 
          error: '매뉴얼을 찾을 수 없습니다.' 
        });
      }
      res.json({ success: true, data: row });
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: '매뉴얼 조회에 실패했습니다.',
      message: error.message 
    });
  }
});

// 매뉴얼 업로드
router.post('/upload', upload.single('manual'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: '파일을 선택해주세요.' 
      });
    }

    const { title, type, size_data } = req.body;
    if (!title) {
      return res.status(400).json({ 
        success: false, 
        error: '매뉴얼 제목을 입력해주세요.' 
      });
    }

    const filePath = req.file.path;
    const fileType = path.extname(req.file.originalname).toLowerCase();
    
    // 이미지 파일인 경우 (사이즈표) 내용 추출 생략
    let content = '';
    if (type === 'sizechart' || ['.jpg', '.jpeg', '.png', '.gif'].includes(fileType)) {
      content = `사이즈표 이미지: ${req.file.originalname}`;
    } else {
      // 파일 내용 추출
      content = await extractFileContent(filePath, fileType);
    }
    
    // 데이터베이스에 저장
    const query = type === 'sizechart' 
      ? 'INSERT INTO manuals (title, content, file_path, file_type, type, size_data) VALUES (?, ?, ?, ?, ?, ?)'
      : 'INSERT INTO manuals (title, content, file_path, file_type, type) VALUES (?, ?, ?, ?, ?)';
    
    const params = type === 'sizechart'
      ? [title, content, filePath, fileType, type || 'file', size_data || '']
      : [title, content, filePath, fileType, type || 'file'];
    
    db.run(query, params, function(err) {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          error: '매뉴얼 저장에 실패했습니다.',
          message: err.message 
        });
      }
      
      res.json({ 
        success: true, 
        data: {
          id: this.lastID,
          title: title,
          fileType: fileType,
          type: type || 'file',
          contentLength: content.length
        },
        message: '매뉴얼이 성공적으로 업로드되었습니다.'
      });
    });
  } catch (error) {
    // 업로드된 파일 삭제
    if (req.file) {
      try {
        await fs.unlink(req.file.path);
      } catch (unlinkError) {
        console.error('파일 삭제 오류:', unlinkError);
      }
    }
    
    res.status(400).json({ 
      success: false, 
      error: '매뉴얼 업로드에 실패했습니다.',
      message: error.message 
    });
  }
});

// 텍스트 매뉴얼 직접 추가
router.post('/text', async (req, res) => {
  try {
    const { title, content, type } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ 
        success: false, 
        error: '제목과 내용을 모두 입력해주세요.' 
      });
    }

    db.run(
      'INSERT INTO manuals (title, content, type) VALUES (?, ?, ?)',
      [title, content, type || 'text'],
      function(err) {
        if (err) {
          return res.status(500).json({ 
            success: false, 
            error: '매뉴얼 저장에 실패했습니다.',
            message: err.message 
          });
        }
        
        res.json({ 
          success: true, 
          data: {
            id: this.lastID,
            title: title,
            type: type || 'text',
            contentLength: content.length
          },
          message: '매뉴얼이 성공적으로 추가되었습니다.'
        });
      }
    );
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: '매뉴얼 추가에 실패했습니다.',
      message: error.message 
    });
  }
});

// 매뉴얼 수정
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ 
        success: false, 
        error: '제목과 내용을 모두 입력해주세요.' 
      });
    }

    db.run(
      'UPDATE manuals SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [title, content, id],
      function(err) {
        if (err) {
          return res.status(500).json({ 
            success: false, 
            error: '매뉴얼 수정에 실패했습니다.',
            message: err.message 
          });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ 
            success: false, 
            error: '매뉴얼을 찾을 수 없습니다.' 
          });
        }
        
        res.json({ 
          success: true, 
          message: '매뉴얼이 성공적으로 수정되었습니다.'
        });
      }
    );
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: '매뉴얼 수정에 실패했습니다.',
      message: error.message 
    });
  }
});

// 매뉴얼 삭제
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 먼저 파일 정보 조회
    db.get('SELECT file_path FROM manuals WHERE id = ?', [id], async (err, row) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          error: '매뉴얼 조회에 실패했습니다.',
          message: err.message 
        });
      }
      
      if (!row) {
        return res.status(404).json({ 
          success: false, 
          error: '매뉴얼을 찾을 수 없습니다.' 
        });
      }

      // 데이터베이스에서 삭제
      db.run('DELETE FROM manuals WHERE id = ?', [id], async function(err) {
        if (err) {
          return res.status(500).json({ 
            success: false, 
            error: '매뉴얼 삭제에 실패했습니다.',
            message: err.message 
          });
        }

        // 파일이 있다면 삭제
        if (row.file_path) {
          try {
            await fs.unlink(row.file_path);
          } catch (unlinkError) {
            console.error('파일 삭제 오류:', unlinkError);
          }
        }

        res.json({ 
          success: true, 
          message: '매뉴얼이 성공적으로 삭제되었습니다.'
        });
      });
    });
  } catch (error) {
    res.status(400).json({ 
      success: false, 
      error: '매뉴얼 삭제에 실패했습니다.',
      message: error.message 
    });
  }
});

module.exports = router;
