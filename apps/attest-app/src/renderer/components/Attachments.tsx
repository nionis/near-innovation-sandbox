import { ImageInStorage } from './Image'
import MiniButton from './MiniButton'
import { Trash2, Link, Link2, Globe } from 'lucide-react'
import { Typography, Tooltip } from '@mui/material'
import FileIcon from './FileIcon'
import { useTranslation } from 'react-i18next'

export function ImageMiniCard(props: { storageKey: string; onDelete: () => void }) {
  const { storageKey, onDelete } = props
  return (
    <div
      key={storageKey}
      className="w-[100px] h-[100px] p-1 m-1 inline-flex items-center justify-center
                                bg-white shadow-sm rounded-md border-solid border-gray-400/20
                                hover:shadow-lg hover:cursor-pointer hover:scale-105 transition-all duration-200
                                group/image-mini-card"
    >
      <ImageInStorage storageKey={storageKey} />
      {onDelete && (
        <MiniButton
          className="hidden group-hover/image-mini-card:inline-block 
                    absolute top-0 right-0 m-1 p-1 rounded-full shadow-lg text-red-500"
          onClick={onDelete}
        >
          <Trash2 size="22" strokeWidth={2} />
        </MiniButton>
      )}
    </div>
  )
}

export function FileMiniCard(props: { name: string; fileType: string; onDelete: () => void }) {
  const { name, onDelete } = props
  return (
    <div
      className="w-[100px] h-[100px] p-1 m-1 inline-flex items-center justify-center
                                bg-white shadow-sm rounded-md border-solid border-gray-400/20
                                hover:shadow-lg hover:cursor-pointer hover:scale-105 transition-all duration-200
                                group/file-mini-card"
    >
      <div className="flex flex-col justify-center items-center">
        <FileIcon filename={name} className="w-8 h-8 text-black" />
        <Typography className="w-20 pt-1 text-black text-center" noWrap sx={{ fontSize: '12px' }}>
          {name}
        </Typography>
      </div>
      {onDelete && (
        <MiniButton
          className="hidden group-hover/file-mini-card:inline-block 
                    absolute top-0 right-0 m-1 p-1 rounded-full shadow-lg text-red-500"
          onClick={onDelete}
        >
          <Trash2 size="18" strokeWidth={2} />
        </MiniButton>
      )}
    </div>
  )
}

export function MessageAttachment(props: { label: string; filename?: string; url?: string }) {
  const { label, filename, url } = props
  return (
    <div
      className="flex justify-start items-center mb-2 p-1.5
            border-solid border-slate-400/20 rounded 
            bg-white dark:bg-slate-800"
    >
      {filename && <FileIcon filename={filename} className="w-6 h-6 ml-1 mr-2 text-black dark:text-white" />}
      {url && <Link2 className="w-6 h-6 ml-1 mr-2 text-black dark:text-white" strokeWidth={1} />}
      <Typography className="w-32" noWrap>
        {label}
      </Typography>
    </div>
  )
}

export function LinkMiniCard(props: { url: string; onDelete: () => void }) {
  const { url, onDelete } = props
  const label = url.replace(/^https?:\/\//, '')
  return (
    <div
      className="w-[100px] h-[100px] p-1 m-1 inline-flex items-center justify-center
                                bg-white shadow-sm rounded-md border-solid border-gray-400/20
                                hover:shadow-lg hover:cursor-pointer hover:scale-105 transition-all duration-200
                                group/file-mini-card"
    >
      <Tooltip title={url}>
        <div className="flex flex-col justify-center items-center">
          <Link className="w-8 h-8 text-black" strokeWidth={1} />
          <Typography className="w-20 pt-1 text-black text-center" noWrap sx={{ fontSize: '10px' }}>
            {label}
          </Typography>
        </div>
      </Tooltip>
      {onDelete && (
        <MiniButton
          className="hidden group-hover/file-mini-card:inline-block 
                    absolute top-0 right-0 m-1 p-1 rounded-full shadow-lg text-red-500"
          onClick={onDelete}
        >
          <Trash2 size="18" strokeWidth={2} />
        </MiniButton>
      )}
    </div>
  )
}
