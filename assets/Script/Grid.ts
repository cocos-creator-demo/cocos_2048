
const { ccclass, property } = cc._decorator;
enum DIR { none, up, left, right, down }

// 本地保存最高分的key
const BEST_SCORE_KEY = 'LOCAL_BEST_SCORE_KEY'

@ccclass
export default class NewClass extends cc.Component {

    @property(cc.Prefab)
    cellPrefab: cc.Prefab

    @property(cc.Label)
    score: cc.Label = null

    @property(cc.Label)
    bestScore: cc.Label = null

    @property(cc.Sprite)
    gameover: cc.Sprite = null

    grid: Array<Array<cc.Node>> = []

    row: number = 4
    col: number = 4
    dir: DIR = DIR.none

    canNextStep: boolean = true // 是否可以继续操作 


    moveLeft: Function
    moveRight: Function
    moveUp: Function
    moveDown: Function


    // LIFE-CYCLE CALLBACKS:
    onLoad() {
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
    }
    onDestroy() {
        // 取消键盘输入监听
        cc.systemEvent.off(cc.SystemEvent.EventType.KEY_DOWN, this.onKeyDown, this);
    }

    start() {
        this.init()
        this.initHandler()

        let replayBtn = this.gameover.node.getChildByName('replay')
        replayBtn.on(cc.Node.EventType.TOUCH_START, () => {
            this.replayGame()
        })
    }

    // METHODS: 
    init() {
        this.score.string = '0'  // 重置score
        this.gameover.node.opacity = 0 // 隐藏gameover弹窗

        // 初始化grid
        let { grid } = this
        this.walkCells((i, ) => {
            let row = new Array(this.col)
            // 渲染
            for (let j = 0; j < this.col; ++j) {
                let cell = cc.instantiate(this.cellPrefab);
                this.node.addChild(cell);
                cell.color = cc.color(238, 228, 218, 0.35)
                cell.getComponent('Cell').label.string = ''
                this.setCellPosition(cell, i, j)
            }
            grid[i] = row
        })

        this.setBestScore()
        // 随机创建一个cell
        this.createRandomCell()
        this.createRandomCell()
    }

    onKeyDown(event) {
        if (!this.canNextStep) {
            console.log('disable')
            return
        }
        this.canNextStep = false

        switch (event.keyCode) {
            case cc.macro.KEY.w:
                this.moveUp()
                break;
            case cc.macro.KEY.d:
                this.moveRight()
                break;
            case cc.macro.KEY.a:
                this.moveLeft()
                break;
            case cc.macro.KEY.s:
                this.moveDown()
                break;
        }

    }


    walkCells(cb) {
        const { row, col } = this
        for (let i = 0; i < row; ++i) {
            for (let j = 0; j < col; ++j) {
                cb(i, j)
            }
        }
    }

    createCell(i: number, j: number) {
        let cell = cc.instantiate(this.cellPrefab);
        this.node.addChild(cell);
        this.grid[i][j] = cell
        this.setCellPosition(cell, i, j)

        // 进场动画
        cell.setScale(0)
        let action = cc.scaleTo(0.5, 1).easing(cc.easeCubicActionOut())
        cell.runAction(action)
    }

    // 找到一个随机的空闲位置并生成cell
    createRandomCell() {
        let freeCells = []
        let { grid } = this
        this.walkCells((i, j) => {
            if (!grid[i][j]) {
                freeCells.push({ i, j })
            }
        })
        if (freeCells.length) {
            let idx = Math.floor(Math.random() * freeCells.length)
            let { i, j } = freeCells[idx]
            this.createCell(i, j)
            return true
        } else {
            return false
        }
    }
    setCellPosition(cell, i, j, needAction = false, cb = () => { }) {
        const width = 100
        const height = 100
        let target = cc.v2((50 + j * width), -50 - i * height)
        if (needAction) {
            let move = cc.moveTo(0.5, target).easing(cc.easeCubicActionOut());
            cell.runAction(cc.sequence(move, cc.callFunc(cb)))
        } else {
            cell.setPosition(target)
        }
        cb()
    }
    addScore(num) {
        let score = this.score
        let scoreVal = parseInt(score.string)
        score.string = scoreVal + num
    }

    getBestScore() {
        return cc.sys.localStorage.getItem(BEST_SCORE_KEY) || '0';
    }
    setBestScore() {
        this.bestScore.string = this.getBestScore()
    }

    gameDie() {
        this.gameover.node.opacity = 1
        // 保存最高得分
        let bestScore = this.getBestScore()
        let currentScore = this.score.string
        if (currentScore > bestScore) {
            cc.sys.localStorage.setItem(BEST_SCORE_KEY, currentScore);
        }
    }
    replayGame() {
        this.init()
    }

    afterEachRound() {
        let isSuccess = this.createRandomCell()
        if (!isSuccess) {
            this.gameDie()
        } else {
            this.canNextStep = true
        }
    }

    // 控制游戏操作
    initHandler() {
        const { row, col, grid } = this

        // 合并某个方向上的列表
        const merge = (arr, pos) => {
            const { col, row } = pos
            let slow
            let nextSpace = []

            const removeCell = (cell, index) => {
                // todo 貌似此处是直接消失的
                const remove = () => {
                    cell.removeFromParent()
                }
                if (col === undefined) {
                    this.setCellPosition(cell, row, index, true, remove)
                } else {
                    this.setCellPosition(cell, index, col, true, remove)
                }
            }

            // 检测与前一个元素是否相同
            const checkSame = (prev, cur, i) => {
                if (prev && cur) {
                    let prevLabel = prev.getComponent('Cell').label
                    let curLabel = cur.getComponent('Cell').label
                    if (prevLabel.string === curLabel.string) {
                        let num = parseInt(prevLabel.string) * 2

                        this.addScore(num) // 增加得分

                        prevLabel.string = num
                        // 索引值变为0，将其插入到nextSpace头部
                        nextSpace.unshift(i)
                        arr[i] = undefined
                        removeCell(cur, i)
                    }
                }
            }

            for (let i = 0; i < arr.length; ++i) {
                if (!arr[i]) {
                    nextSpace.push(i) // 保存空位
                    if (slow === undefined) {
                        slow = nextSpace.shift()
                    }
                } else if (slow !== undefined) {
                    // 交换slow和i的位置
                    arr[slow] = arr[i]
                    arr[i] = undefined
                    nextSpace.push(i)

                    // 合并相同数字
                    let prev = arr[slow - 1]
                    let cur = arr[slow]

                    checkSame(prev, cur, slow)

                    slow = nextSpace.shift()
                } else {
                    let prev = arr[i - 1]
                    let cur = arr[i]
                    checkSame(prev, cur, i)

                    slow = nextSpace.shift()
                }
            }
            return arr
        }

        const move = () => {
            let cellNum = 0
            let finishNum = 0
            // 统计有效个数
            this.walkCells((i, j) => {
                let cell = this.grid[i][j]
                if (cell) {
                    cellNum++
                }
            })
            // 将grid中的元素展示到更新后的位置
            this.walkCells((i, j) => {
                let cell = this.grid[i][j]
                cell && this.setCellPosition(cell, i, j, true, () => {
                    finishNum++
                    // 所有动画完成，开始随机创建一个新cell
                    if (finishNum === cellNum) {
                        setTimeout(() => {
                            this.afterEachRound()
                        })
                    }
                })
            })
        }

        // todo 优化下面代码
        this.moveUp = () => {
            for (let i = 0; i < col; ++i) {
                let arr = []
                for (let j = 0; j < row; ++j) {
                    arr.push(grid[j][i])
                }
                merge(arr, { col: i })
                for (let j = 0; j < row; ++j) {
                    grid[j][i] = arr.shift()
                }
            }
            move()
        }
        this.moveDown = () => {
            for (let i = 0; i < col; ++i) {
                let arr = []
                for (let j = row - 1; j >= 0; --j) {
                    arr.push(grid[j][i])
                }
                merge(arr, { col: i })
                for (let j = row - 1; j >= 0; --j) {
                    grid[j][i] = arr.shift()
                }
            }
            move()
        }
        this.moveRight = () => {
            for (let i = row - 1; i >= 0; --i) {
                let arr = []
                for (let j = col - 1; j >= 0; --j) {
                    arr.push(grid[i][j])
                }
                merge(arr, { row: i })
                for (let j = col - 1; j >= 0; --j) {
                    grid[i][j] = arr.shift()
                }
            }
            move()
        }

        this.moveLeft = () => {
            for (let i = 0; i < row; ++i) {
                let arr = grid[i].slice()
                merge(arr, { row: i })
                grid[i] = arr
            }
            move()
        }
    }

    // // 打印网格
    // printGrid() {
    //     let { row, col } = this
    //     let str = ''
    //     for (let i = 0; i < row; ++i) {
    //         for (let j = 0; j < col; ++j) {
    //             let cell = this.grid[i][j]
    //             if (cell) {
    //                 str += ` ${cell.getComponent('Cell').label.string} `
    //             } else {
    //                 str += ' x '
    //             }
    //         }
    //         str += '\n'
    //     }
    //     console.log(str)
    // }

    // // 绘制初始地图
    // drawMap() {
    //     let node = this.node
    //     const { width, height } = node
    //     const { row, col } = this

    //     let graphics: cc.Graphics = node.addComponent(cc.Graphics)
    //     graphics.lineWidth = 1
    //     graphics.strokeColor = cc.color(255, 0, 0, 255)

    //     for (let i = 0; i <= row; ++i) {
    //         let y = i * height / row
    //         graphics.moveTo(0, -y)
    //         graphics.lineTo(width, -y)
    //         graphics.close()
    //     }
    //     for (let i = 0; i <= col; ++i) {
    //         let x = i * width / col
    //         graphics.moveTo(x, 0)
    //         graphics.lineTo(x, -height)
    //         graphics.close()
    //     }
    //     graphics.stroke()
    //     graphics.fill()
}
}
