import { ref } from 'vue'
import { getEnvBaseUrl } from '@/utils/index'

const VITE_UPLOAD_BASEURL = `${getEnvBaseUrl()}/upload`

type TfileType = 'image' | 'file'
type TImage = 'png' | 'jpg' | 'jpeg' | 'webp' | '*'
type TFile = 'doc' | 'docx' | 'ppt' | 'zip' | 'xls' | 'xlsx' | 'txt' | TImage
type UploadFormData = Record<string, string | number | boolean | undefined>
type UploadHookError = Error | UniApp.GeneralCallbackResult

type SelectedFile = {
  tempFilePath: string
  size: number
}

type SelectFileResult = {
  tempFilePaths?: string[]
  tempFiles?: Array<{
    tempFilePath?: string
    size?: number
  }>
}

interface TOptions<T extends TfileType> {
  formData?: UploadFormData
  maxSize?: number
  accept?: T extends 'image' ? TImage[] : TFile[]
  fileType?: T
  success?: (params: unknown) => void
  error?: (err: UploadHookError) => void
}

const toUploadError = (error: unknown, fallback: string): Error => {
  if (error instanceof Error) {
    return error
  }

  const message = typeof error === 'object' && error !== null && typeof Reflect.get(error, 'errMsg') === 'string'
    ? String(Reflect.get(error, 'errMsg'))
    : fallback

  return new Error(message)
}

const parseUploadResponse = (payload: string): unknown => {
  const parsed = JSON.parse(payload) as { data?: unknown }
  return parsed.data ?? parsed
}

const resolveSelectedFile = (result: unknown): SelectedFile | null => {
  if (!result || typeof result !== 'object') {
    return null
  }

  const { tempFiles, tempFilePaths } = result as SelectFileResult
  const tempFile = tempFiles?.[0]
  const tempFilePath = tempFile?.tempFilePath ?? tempFilePaths?.[0]
  const size = tempFile?.size

  if (!tempFilePath || typeof size !== 'number') {
    return null
  }

  return { tempFilePath, size }
}

// Deprecated for avatar upload: use useManagedAvatarUpload for prepare/callback split upload.
export default function useUpload<T extends TfileType>(options: TOptions<T> = {}) {
  const {
    formData = {},
    maxSize = 5 * 1024 * 1024,
    accept = ['*'],
    fileType = 'image',
    success,
    error: onError,
  } = options

  const loading = ref(false)
  const error = ref<Error | null>(null)
  const data = ref<unknown>(null)

  const handleFileChoose = ({ tempFilePath, size }: { tempFilePath: string, size: number }) => {
    if (size > maxSize) {
      uni.showToast({
        title: `文件大小不能超过 ${maxSize / 1024 / 1024}MB`,
        icon: 'none',
      })
      return
    }

    // const fileExtension = file?.tempFiles?.name?.split('.').pop()?.toLowerCase()
    // const isTypeValid = accept.some((type) => type === '*' || type.toLowerCase() === fileExtension)

    // if (!isTypeValid) {
    //   uni.showToast({
    //     title: `仅支持 ${accept.join(', ')} 格式的文件`,
    //     icon: 'none',
    //   })
    //   return
    // }

    loading.value = true
    uploadFile({
      tempFilePath,
      formData,
      onSuccess: (res) => {
        // 修改这里的解析逻辑，适应不同平台的返回格式
        let parsedData: unknown = res
        try {
          // 尝试解析为JSON
          parsedData = parseUploadResponse(res)
        }
        catch (e) {
          // 如果解析失败，使用原始数据
          console.log('Response is not JSON, using raw data:', res)
        }
        data.value = parsedData
        // console.log('上传成功', res)
        success?.(parsedData)
      },
      onError: (err) => {
        error.value = err instanceof Error ? err : new Error(err.errMsg)
        onError?.(err)
      },
      onComplete: () => {
        loading.value = false
      },
    })
  }

  const run = () => {
    // 微信小程序从基础库 2.21.0 开始， wx.chooseImage 停止维护，请使用 uni.chooseMedia 代替。
    // 微信小程序在2023年10月17日之后，使用本API需要配置隐私协议
    const chooseFileOptions = {
      count: 1,
      success: (res: unknown) => {
        console.log('File selected successfully:', res)
        // 小程序中res:{errMsg: "chooseImage:ok", tempFiles: [{fileType: "image", size: 48976, tempFilePath: "http://tmp/5iG1WpIxTaJf3ece38692a337dc06df7eb69ecb49c6b.jpeg"}]}
        // h5中res:{errMsg: "chooseImage:ok", tempFilePaths: "blob:http://localhost:9000/f74ab6b8-a14d-4cb6-a10d-fcf4511a0de5", tempFiles: [File]}
        // h5的File有以下字段：{name: "girl.jpeg", size: 48976, type: "image/jpeg"}
        // App中res:{errMsg: "chooseImage:ok", tempFilePaths: "file:///Users/feige/xxx/gallery/1522437259-compressed-IMG_0006.jpg", tempFiles: [File]}
        // App的File有以下字段：{path: "file:///Users/feige/xxx/gallery/1522437259-compressed-IMG_0006.jpg", size: 48976}
        const selectedFile = resolveSelectedFile(res)
        if (!selectedFile) {
          const selectionError = new Error('无法解析所选文件')
          error.value = selectionError
          onError?.(selectionError)
          return
        }

        handleFileChoose(selectedFile)
      },
      fail: (err: unknown) => {
        console.error('File selection failed:', err)
        const uploadError = toUploadError(err, '文件选择失败')
        error.value = uploadError
        onError?.(uploadError)
      },
    }

    if (fileType === 'image') {
      // #ifdef MP-WEIXIN
      uni.chooseMedia({
        ...chooseFileOptions,
        mediaType: ['image'],
      })
      // #endif

      // #ifndef MP-WEIXIN
      uni.chooseImage(chooseFileOptions)
      // #endif
    }
    else {
      uni.chooseFile({
        ...chooseFileOptions,
        type: 'all',
      })
    }
  }

  return { loading, error, data, run }
}

async function uploadFile({
  tempFilePath,
  formData,
  onSuccess,
  onError,
  onComplete,
}: {
  tempFilePath: string
  formData: UploadFormData
  onSuccess: (data: string) => void
  onError: (err: UploadHookError) => void
  onComplete: () => void
}) {
  uni.uploadFile({
    url: VITE_UPLOAD_BASEURL,
    filePath: tempFilePath,
    name: 'file',
    formData,
    success: (uploadFileRes) => {
      try {
        const data = uploadFileRes.data
        onSuccess(data)
      }
      catch (err: unknown) {
        onError(toUploadError(err, '上传失败'))
      }
    },
    fail: (err) => {
      console.error('Upload failed:', err)
      onError(err)
    },
    complete: onComplete,
  })
}
