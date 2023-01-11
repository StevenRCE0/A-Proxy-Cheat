// create a nodejs server
import { createServer } from 'http'
import { readFileSync } from 'fs'
import { config } from 'dotenv'

// read from env file
config()
const port = process.env.PORT ?? 3000
const useHttps = process.env.HTTPS === undefined ? false : !!process.env.HTTPS
const url = process.env.URL
const filePath = process.env.FILE

if (!url || !filePath) {
    throw new Error('No URL or FILE provided in environment variables')
}

function readSection(str, section) {
    let lines = str.split('\n')
    let i = 0
    while (i < lines.length) {
        if (lines[i].trimEnd() === `[${section}]`) {
            let start = i
            i += 1
            while (
                lines[i] !== '' &&
                lines[i].match(/^\[.+]$/) === null &&
                i < lines.length
            ) {
                i += 1
            }
            let end = i
            return lines.slice(start, end).join('\n')
        }
        i++
    }
    console.warn(`Section [${section}] not found when reading`)
    return ''
}

function replaceSection(str, newStr, section) {
    let lines = str.split('\n')
    let i = 0
    while (i < lines.length) {
        if (lines[i].trimEnd() === `[${section}]`) {
            let start = i
            i += 1
            while (
                lines[i] !== '' &&
                lines[i].match(/^\[.+]$/) === null &&
                i < lines.length
            ) {
                i += 1
            }
            let end = i
            lines.splice(start, end - start, newStr)
            return lines.join('\n')
        }
        i++
    }
    console.warn(`Section [${section}] not found when replacing`)
    return str
}

createServer(async (req, res) => {
    // get the content of the given url
    const fetcher = await fetch(url).then((res) => res)
    const content = await fetcher.text()
    const fetchedHeaders = fetcher.headers
    const headers = {
        'Content-Type': fetchedHeaders.get('Content-Type'),
        'Content-Disposition': 'attachment; filename=Aggregated.conf',
    }
    let targetContent = readFileSync(filePath, 'utf8')
    const requestURL = new URL(req.url, `http://${req.headers.host}`)
    let sections = requestURL.search.substring(1).split('&')

    if (
        sections.length === 0 ||
        (sections.length === 1 && sections[0] === '')
    ) {
        res.writeHead(200, headers)
        res.end(content)
        return
    }

    // proccess url characters
    sections = sections.map((section) => decodeURI(section))
    targetContent = `#!MANAGED-CONFIG http${useHttps ? 's' : ''}://${req.headers.host}${req.url.toString()}\n` + targetContent

    console.log(
        `Request for ${sections.length.toString()} ${sections.join(', ')}`
    )

    // replace the content of the file
    sections.forEach((section) => {
        const extractedContent = readSection(content, section)
        targetContent = replaceSection(targetContent, extractedContent, section)
    })

    res.writeHead(200, headers)
    res.end(targetContent)
}).listen(port)
