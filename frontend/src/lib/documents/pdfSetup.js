import pdfMake from 'pdfmake/build/pdfmake'
import pdfFonts from 'pdfmake/build/vfs_fonts'

// pdfmake 0.3.x: fonts are registered via addVirtualFileSystem (the old
// `pdfMake.vfs = ...` assignment from 0.1.x/0.2.x no longer works). Doing
// this once here, imported wherever pdfMake is used.
pdfMake.addVirtualFileSystem(pdfFonts)

export default pdfMake
