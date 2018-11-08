module.exports = {
  analyze: sus => {
    const validLines = sus.split('\n').filter(line => line.slice(0,1) === "#").map(line => line.slice(1))
    const data = {}

    data.BPMs = validLines.filter(line => line.match(/^\d{3}08:/))
      .map(line => ({measure: Number(line.slice(0,3)), defnum: Number(line.split(':')[1].trim())}))
      .sort((a,b) => a.measure < b.measure ? -1 : a.measure > b.measure ? 1 : 0)

    data.BEATs = validLines.filter(line => line.match(/^\d{3}02:/))
      .map(line => ({measure: Number(line.slice(0,3)), beat: Number(line.split(':')[1].trim())}) )
      .sort((a,b) => a.measure < b.measure ? -1 : a.measure > b.measure ? 1 : 0)

    data.shortNoteLines = validLines.filter(line => line.match(/^\d{3}[15][0-9a-fA-F]:/))
      .map(line => {
        let l = {}
        l.measure = Number(line.slice(0,3))
        l.type = line.slice(3,4)
        l.lane = parseInt(line.slice(4,5), 16)
        const data = line.split(':')[1].trim().replace(/ /g,'')
        l.split = data.length / 2
        l.data = []
        for (let i = 0; i < data.length / 2; i++) {
          l.data.push({pos: i,type: data[i*2], width: parseInt(data[i*2+1], 17)})
        }
        return l
      })
      .sort((a,b) => a.measure < b.measure ? -1 : a.measure > b.measure ? 1 : 0)

    data.longNotes = []

    let mea = []
    validLines.filter(line => line.match(/^\d{3}[2-4][0-9a-fA-F][0-9a-zA-Z]:/))
      .map(line => {
        let l = {}
        l.measure = Number(line.slice(0,3))
        l.type = line.slice(3,4)
        l.lane = parseInt(line.slice(4,5), 16)
        const data = line.split(':')[1].trim().replace(/ /g,'')
        l.split = data.length / 2
        l.id = parseInt(line.slice(5,6), 36)
        l.data = []
        for (let i = 0; i < data.length / 2; i++) {
          l.data.push({pos: i,type: data[i*2], width: parseInt(data[i*2+1], 17)})
        }
        return l
      })
      .sort((a,b) => a.measure < b.measure ? -1 : a.measure > b.measure ? 1 : 0)
      .forEach(e => {
        if (!mea[e.measure]) mea[e.measure] = []
        mea[e.measure].push(e)
      })

    let lcms = []
    // 最小公倍数で穴埋め
    mea = mea.map((measure,index) => {
      if(measure.length < 2) {
        lcms[index] = measure[0].split
        return measure
      }

      let splits = []
      measure.forEach(lane => splits.push(lane.split))

      let cur = lcm(splits[0],splits[1])
      for(let i = 1; i < splits.length - 1; i++) cur = lcm(cur,splits[i+1])

      lcms[index] = cur

      return measure.map(e => {
        e.data = e.data.map(d => {
          d.pos = d.pos * cur / e.split
          return d
        })
        e.split = cur
        return e
      })
    })

    let longs = {}
    mea.forEach((measure,index) => {
      for(let i = 0; i < lcms[index]; i++) {
        for(let j = 0; j < 3; j++) {
          measure.forEach(e => {
            e.data.forEach(d => {
              if(d.pos !== i) return
              if(d.type === '0') return
              if(j == 0) {
                //TODO: 無い時の処理（= d.type == 1が未処理）
                if(d.type == '2') {
                  if(e.type == '2') {
                    longs[e.type][e.lane][e.id].notes.push({measure: index,lane: e.lane,pos: d.pos, type: d.type, width: d.width ,split: e.split})
                    data.longNotes.push(longs[e.type][e.lane][e.id])
                    longs[e.type][e.lane][e.id] == null
                  } else {
                    longs[e.type][e.id].notes.push({measure: index,lane: e.lane,pos: d.pos, type: d.type, width: d.width ,split: e.split})
                    data.longNotes.push(longs[e.type][e.id])
                    longs[e.type][e.id] == null
                  }
                }
              } else if(j == 1) {
                if(d.type == '3' || d.type == '4' || d.type == '5') {
                  if(e.type == '2') {
                    longs[e.type][e.lane][e.id].notes.push({measure: index,lane: e.lane,pos: d.pos, type: d.type, width: d.width ,split: e.split})
                  } else {
                    longs[e.type][e.id].notes.push({measure: index,lane: e.lane,pos: d.pos, type: d.type, width: d.width ,split: e.split})
                  }
                }
              } else {
                if(d.type == '1') {
                  if(!longs.hasOwnProperty(e.type)) longs[e.type] = {}
                  if(e.type == '2') {
                    if(!longs[e.type].hasOwnProperty(e.lane)) longs[e.type][e.lane] = {}
                    longs[e.type][e.lane][e.id] = {type: e.type, notes: []}
                    longs[e.type][e.lane][e.id].notes.push({measure: index,lane: e.lane,pos: d.pos, type: d.type, width: d.width ,split: e.split})
                  } else {
                    longs[e.type][e.id] = {type: e.type, notes: []}
                    longs[e.type][e.id].notes.push({measure: index,lane: e.lane,pos: d.pos, type: d.type, width: d.width ,split: e.split})
                  }
                }
              }
            })
          })
        }
      }
    })

    data.measure = validLines.filter(line => line.match(/^\d{3}[2-4][0-9a-fA-F][0-9a-zA-Z]?:/))
      .map(line => Number(line.slice(0,3)))
      .reduce((a,b) => a > b ? a : b) + 1

    return data
  }
}

function lcm(a, b) {
  if(a < b){
    let tmp = a
    a = b
    b = tmp
  }
  let a_1 = a
  let b_1 = b
  let r = 0
  do {
    r = a_1 % b_1
    a_1 = b_1
    b_1 = r
  } while(b_1 !== 0)
  return a * b / a_1
}
