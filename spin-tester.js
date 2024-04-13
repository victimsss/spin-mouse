Vue.component('spin-tester', {
    template: `
        <div>
            <div>圈数: {{ cumulate }}</div>
            <div>速度: {{ speed.toFixed(2) }} r/s</div>
            <div>扇区: {{ direction }}</div>
        </div>
    `,
    data () {
        return {
            pos: null,
            arrSection: [0, 0, 0, 0],
            mousePosArr: [],
            cumulate: 0,
            speed: 0,
            fixSpeed: 0,
            smoothedSpeed: 0,
            section: null,
            direction: '未知',
            isTracking: true,
            timeout: 20, // 采样间隙 20 ms 
            trackTimer: null,
            lock: false,
            dampingCoefficient: 0.1
        };
    },
    created () {
        // 定时器
        this.trackTimer = setInterval(this.trackingState, this.timeout);
        // 添加鼠标移动事件监听
        document.addEventListener('mousemove', this.handleMouseMove);
    },
    beforeDestroy () {
        // 清除定时器和事件监听器
        clearInterval(this.trackTimer);
        document.removeEventListener('mousemove', this.handleMouseMove);
    },
    methods: {
        // 允许采样
        trackingState () {
            this.isTracking = true;
        },
        // 处理鼠标移动事件
        handleMouseMove (e) {
            if (this.isTracking) {
                // 获取前一个鼠标位置
                const prePos = this.mousePosArr.length > 0 ? this.mousePosArr[this.mousePosArr.length - 1] : null;
                // 获取当前鼠标位置
                this.pos = this.getMousePosition(e);
                // 将当前鼠标位置添加到数组中
                this.mousePosArr.push(this.pos);
                // 确定当前鼠标位置的扇区
                let section = this.determineSection(prePos, this.pos);

                // 如果确定了扇区
                if (section) {
                    // 更新方向信息
                    this.direction = this.getDirection(section);
                    // 更新扇区信息和圈数
                    this.updateSection(section);
                }

                // 计算并更新速度
                if (prePos && this.pos) {

                    this.updateSpeed(prePos, this.pos)
                }

                // 更新状态
                this.isTracking = false;
            }
        },
        // 获取鼠标的位置
        getMousePosition (e) {

            if (e.pageX || e.pageY) {
                return { x: e.pageX, y: e.pageY };
            }
            return {
                x: e.clientX + document.body.scrollLeft - document.body.clientLeft,
                y: e.clientY + document.body.scrollTop - document.body.clientTop
            };
        },
        // 清除状态并重置为初始值
        clearState () {
            this.pos = null;
            this.speed = 0;
            this.mousePosArr = [];
            this.arrSection.fill(0);
            this.direction = '未知';
        },
        // 计算两个点之间的距离
        calcDistance (p1, p2) {
            const diffX = p2.x - p1.x;
            const diffY = p2.y - p1.y;
            return Math.sqrt(diffX * diffX + diffY * diffY);
        },
        // 根据给定的 section 更新当前扇区信息和圈数
        updateSection (section) {
            // 更新扇区的访问次数
            this.arrSection[section - 1] = 1;

            // 计算访问过的扇区数量
            const sectionsCount = this.arrSection.reduce((count, value) => count + value, 0);

            // 如果所有扇区都被访问过
            if (sectionsCount === 4) {
                // 增加一个圈数
                this.cumulate++;
                // 重置状态
                this.clearState();
            }

            // 确定扇区的顺时针旋转顺序
            const pre = [4, 1, 2, 3][section - 1];
            const next = [2, 3, 4, 1][section - 1];

            // 判断是否为顺时针运动
            const clockwise = (
                (this.arrSection[pre - 1] === 0 || this.arrSection[pre - 1] === 1)
                && this.arrSection[next - 1] === 0
                && sectionsCount < 4
            );

            // 如果不为顺时针，则重置状态
            if (!clockwise) {
                this.clearState();
            }
        },
        // 根据 section 返回方向
        getDirection (section) {
            switch (section) {
                case 1:
                    return '右上';
                case 2:
                    return '右下';
                case 3:
                    return '左下';
                case 4:
                    return '左上';
                default:
                    return '未知';
            }
        },


        // 使用阻尼和线性插值平滑速度变化
        // damp (current, target, lambda, dt) {
        //     return this.lerp(current, target, 1 - Math.exp(-lambda * dt));
        // },

        /**
         *  https://github.com/studio-freight/lenis
         * @param {*} start 
         * @param {*} end 
         * @param {*} amt 
         * @returns 
         */
        // 对两个值进行线性插值
        lerp (start, end, amt) {
            return (1 - amt) * start + amt * end;
        },

        /**
         * 
         * @param {*} start 
         * @param {*} end 
         * @param {*} damping 
         * @param {*} threshold 
         * @returns 
         */
        async interpolateValues (start, end, damping, threshold = 0.01) {
            if (this.lock) {
                return;
            }
            this.lock = true;

            let currentSpeed = start;

            try {
                // 使用 Promise 来递增速度
                await new Promise((resolve) => {
                    const interpolate = async (current) => {
                        // 计算当前值和目标值之间的线性插值
                        const interpolatedValue = this.lerp(current, end, damping);

                        // 计算插值后的差距
                        const difference = Math.abs(interpolatedValue - end);

                        // 如果差距小于阈值，结束递增
                        if (difference < threshold) {
                            resolve(interpolatedValue);
                        } else {
                            // 更新速度
                            this.speed = interpolatedValue;

                            // 继续递增速度
                            setTimeout(() => interpolate(interpolatedValue), 5);
                        }
                    };

                    // 递归
                    interpolate(currentSpeed);
                });

                this.speed = end;
            } finally {
                this.lock = false;
            }
        },

        // 更新速度
        async updateSpeed (prePos, pos) {
            // 计算距离
            const distance = this.calcDistance(prePos, pos);

            // 计算速度
            const targetSpeed = distance > 0 ? distance / this.timeout : 0;

            // 调用插值方法将 this.speed 动态调整到目标速度
            await this.interpolateValues(this.speed, targetSpeed, this.dampingCoefficient);


            // 重置计时器
            clearTimeout(this.speedTimer);

            this.speedTimer = setTimeout(async () => {
                await await this.interpolateValues(this.speed, 0, this.dampingCoefficient)
            }, 50);
        },

        // 确定当前位置所属的扇区
        determineSection (prePos, pos) {
            // 如果没有前一个位置，则返回空
            if (!prePos) return null;

            // 根据鼠标当前位置和前一个位置确定扇区
            if (prePos.x < pos.x && prePos.y < pos.y) {
                return 1;
            } else if (prePos.x > pos.x && prePos.y < pos.y) {
                return 2;
            } else if (prePos.x > pos.x && prePos.y > pos.y) {
                return 3;
            } else if (prePos.x < pos.x && prePos.y > pos.y) {
                return 4;
            }

            // 如果无法确定扇区，则返回空
            return null;
        }
    }
});

new Vue({
    el: '#app',
});
