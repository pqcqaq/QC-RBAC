import type { CurrentUser, UploadPartTarget } from '@rbac/api-common'
import { ref } from 'vue'
import { appApi } from '@/api/client'
import { getErrorMessage } from '@/utils/error'

export const DEFAULT_AVATAR_MAX_SIZE_MB = 5
export const DEFAULT_AVATAR_MAX_WIDTH = 1400
export const DEFAULT_AVATAR_MAX_HEIGHT = 1400

type SelectedImageFile = {
  filePath: string
  size: number
  fileName: string
  contentType: string
}

const imageExtToMimeTypeMap: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
}

const inferMimeType = (fileName: string) => {
  const normalized = fileName.trim().toLowerCase()
  const ext = normalized.includes('.') ? normalized.slice(normalized.lastIndexOf('.')) : ''
  return imageExtToMimeTypeMap[ext] || 'image/jpeg'
}

const parseFileName = (filePath: string) => {
  const normalized = filePath.replace(/\\/g, '/')
  const maybeName = normalized.slice(normalized.lastIndexOf('/') + 1).trim()
  return maybeName || `avatar-${Date.now()}.jpg`
}

const normalizeSelectedImageFile = (result: any): SelectedImageFile | null => {
  const tempFile = result?.tempFiles?.[0]
  const filePath = tempFile?.tempFilePath
    || tempFile?.path
    || result?.tempFilePaths?.[0]
    || ''
  const size = Number(tempFile?.size || 0)
  const fileName = String(tempFile?.name || parseFileName(filePath))
  const contentType = String(tempFile?.type || inferMimeType(fileName))

  if (!filePath || !size) {
    return null
  }

  return {
    filePath,
    size,
    fileName,
    contentType,
  }
}

const chooseImageFile = () => {
  return new Promise<SelectedImageFile>((resolve, reject) => {
    const handleSuccess = (result: any) => {
      const selected = normalizeSelectedImageFile(result)
      if (!selected) {
        reject(new Error('无法解析所选图片，请重试'))
        return
      }
      resolve(selected)
    }

    // #ifdef MP-WEIXIN
    uni.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: handleSuccess,
      fail: reject,
    })
    // #endif

    // #ifndef MP-WEIXIN
    uni.chooseImage({
      count: 1,
      sourceType: ['album', 'camera'],
      success: handleSuccess,
      fail: reject,
    })
    // #endif
  })
}

const getImageSize = (filePath: string) => {
  return new Promise<{ width: number, height: number }>((resolve, reject) => {
    uni.getImageInfo({
      src: filePath,
      success: (res) => resolve({ width: res.width, height: res.height }),
      fail: reject,
    })
  })
}

const uploadPartByUni = async (part: UploadPartTarget, filePath: string) => {
  await new Promise<void>((resolve, reject) => {
    uni.uploadFile({
      url: part.url,
      filePath,
      name: 'file',
      formData: part.fields,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve()
          return
        }
        reject(new Error(`上传分片失败，状态码 ${res.statusCode}`))
      },
      fail: reject,
    })
  })
}

type ManagedAvatarUploadOptions = {
  maxSizeMb?: number
  maxWidth?: number
  maxHeight?: number
}

export function useManagedAvatarUpload(options: ManagedAvatarUploadOptions = {}) {
  const uploading = ref(false)
  const maxSizeMb = options.maxSizeMb ?? DEFAULT_AVATAR_MAX_SIZE_MB
  const maxWidth = options.maxWidth ?? DEFAULT_AVATAR_MAX_WIDTH
  const maxHeight = options.maxHeight ?? DEFAULT_AVATAR_MAX_HEIGHT
  const maxSizeBytes = maxSizeMb * 1024 * 1024

  const selectAndUploadAvatar = async (): Promise<CurrentUser> => {
    const selected = await chooseImageFile()
    if (selected.size > maxSizeBytes) {
      throw new Error(`头像文件不能超过 ${maxSizeMb}MB`)
    }

    const { width, height } = await getImageSize(selected.filePath)
    if (width > maxWidth || height > maxHeight) {
      throw new Error(`头像尺寸不能超过 ${maxWidth}x${maxHeight}`)
    }

    uploading.value = true
    try {
      const plan = await appApi.files.prepareUpload({
        kind: 'avatar',
        fileName: selected.fileName,
        contentType: selected.contentType,
        size: selected.size,
        tag1: 'app',
        tag2: 'avatar',
      })

      if (plan.parts.length !== 1 || plan.strategy !== 'single') {
        throw new Error('头像文件过大，请压缩后重试')
      }

      await uploadPartByUni(plan.parts[0], selected.filePath)
      const completed = await appApi.files.completeUpload({ fileId: plan.fileId })
      return await appApi.auth.updateAvatar(completed.fileId)
    }
    catch (error: unknown) {
      throw new Error(getErrorMessage(error, '头像上传失败'))
    }
    finally {
      uploading.value = false
    }
  }

  const removeAvatar = async (): Promise<CurrentUser> => {
    uploading.value = true
    try {
      return await appApi.auth.updateAvatar(null)
    }
    finally {
      uploading.value = false
    }
  }

  return {
    uploading,
    selectAndUploadAvatar,
    removeAvatar,
  }
}
