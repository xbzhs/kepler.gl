// Copyright (c) 2020 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

import React, {Component, createRef} from 'react';
import PropTypes from 'prop-types';
import styled from 'styled-components';
import {event, select} from 'd3-selection';
import {brushX} from 'd3-brush';
import {normalizeSliderValue} from 'utils/data-utils';

const StyledG = styled.g`
  .selection {
    stroke: none;
    fill: ${props => (props.isRanged ? props.theme.rangeBrushBgd : props.theme.BLUE2)};
    fill-opacity: ${props => (props.isRanged ? 0.3 : 1)};
  }
  .handle {
    fill: ${props => props.theme.BLUE2};
    fill-opacity: 0.3;
  }
`;

function moveRight(startSel, selection) {
  const [startSel0] = startSel;
  const [sel0] = selection;

  return Boolean(startSel0 === sel0);
}

function RangeBrushFactory() {
  class RangeBrush extends Component {
    static propTypes = {
      onBrush: PropTypes.func.isRequired,
      range: PropTypes.arrayOf(PropTypes.number).isRequired,
      value: PropTypes.arrayOf(PropTypes.number).isRequired,
      width: PropTypes.number.isRequired,
      isRanged: PropTypes.bool
    };

    static defaultProps = {
      isRanged: true
    };

    componentDidMount() {
      // We want the React app to respond to brush state and vice-versa
      // but d3-brush fires the same events for both user-initiated brushing
      // and programmatic brushing (brush.move). We need these flags to
      // distinguish between the uses.
      //
      // We don't use state because that would trigger another `componentDidUpdate`

      this.brushing = false;
      this.moving = false;

      this.root = select(this.rootContainer.current);
      this.brush = brushX()
        .handleSize(3)
        .on('start', () => {
          if (typeof this.props.onBrushStart === 'function') this.props.onBrushStart();
          this._startSel = event.selection;
        })
        .on('brush', () => {
          if (this.moving) {
            return;
          }
          if (event.selection) {
            this.brushing = true;
            this._brushed(event);
          }
        })
        .on('end', () => {
          if (!this.brushing && this._startSel && !event.selection) {
            // handle click

            this._click(this._startSel);
          }
          if (typeof this.props.onBrushEnd === 'function') this.props.onBrushEnd();

          this.brushing = false;
          this.moving = false;
        });

      this.root.call(this.brush);

      const {
        value: [val0, val1]
      } = this.props;
      this.moving = true;
      this._move(val0, val1);
    }

    componentDidUpdate(prevProps) {
      const {
        value: [val0, val1],
        width
      } = this.props;
      const [prevVal0, prevVal1] = prevProps.value;

      if (prevProps.width !== width) {
        // width change should not trigger this._brushed
        this.moving = true;
        this.root.call(this.brush);
        this._move(val0, val1);
      }

      if (!this.brushing && !this.moving) {
        if (prevVal0 !== val0 || prevVal1 !== val1) {
          this.moving = true;
          this._move(val0, val1);
        }
      }
    }

    rootContainer = createRef();

    _click(selection) {
      // fake brush
      this.brushing = true;
      this._brushed({sourceEvent: {}, selection});
    }

    _move(val0, val1) {
      const {
        range: [min, max],
        width,
        isRanged
      } = this.props;

      if (width && max - min) {
        const scale = x => ((x - min) * width) / (max - min);
        if (!isRanged) {
          // only draw a 1 pixel line
          this.brush.move(this.root, [scale(val0), scale(val0) + 1]);
        } else {
          this.brush.move(this.root, [scale(val0), scale(val1)]);
        }
      }
    }

    _brushed = evt => {
      if (evt.sourceEvent.type === 'brush') return;
      const [sel0, sel1] = evt.selection;
      const right = moveRight(this._startSel, evt.selection);

      const {
        range: [min, max],
        step,
        width,
        marks,
        isRanged
      } = this.props;
      const invert = x => (x * (max - min)) / width + min;
      let d0 = invert(sel0);
      let d1 = invert(sel1);

      d0 = normalizeSliderValue(d0, min, step, marks);
      d1 = normalizeSliderValue(d1, min, step, marks);

      if (isRanged) this._move(d0, d1);
      else this._move(right ? d1 : d0);

      if (isRanged) this._onBrush(d0, d1);
      else this._onBrush(right ? d1 : d0);
    };

    _onBrush(val0, val1) {
      const {
        isRanged,
        value: [currentVal0, currentVal1]
      } = this.props;

      if (currentVal0 === val0 && currentVal1 === val1) {
        return;
      }

      if (isRanged) {
        this.props.onBrush(val0, val1);
      } else {
        this.props.onBrush(val0, val0);
      }
    }

    render() {
      const {isRanged} = this.props;

      return (
        <StyledG className="kg-range-slider__brush" isRanged={isRanged} ref={this.rootContainer} />
      );
    }
  }
  return RangeBrush;
}

export default RangeBrushFactory;
