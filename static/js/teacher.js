const ctx1 = document.getElementById('classChart');
new Chart(ctx1, {
  type: 'bar',
  data: {
    labels: ['ВПУ', 'Түзету', 'Қ-ңдрау', 'Анауне', 'Ситтеу', 'Ғзалау'],
    datasets: [{
      label: 'Ұпай',
      data: [70, 35, 45, 60, 40, 55],
      backgroundColor: '#1e4fa8'
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false, // важно!
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: {
        ticks: {
          font: ctx => ({
            size: Math.max(10, Math.round(ctx.chart.width / 40))
          })
        }
      },
      y: {
        ticks: {
          font: ctx => ({
            size: Math.max(10, Math.round(ctx.chart.width / 40))
          })
        }
      }
    }
  }
});

const ctx2 = document.getElementById('topicChart');
new Chart(ctx2, {
  type: 'doughnut',
  data: {
    labels: ['Ақпаратты шифрлау', 'Компьютерлік графика', 'Робототехника'],
    datasets: [{
      data: [65, 54, 82],
      backgroundColor: ['#1e4fa8', '#4db6ff', '#82c91e']
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          font: ctx => ({
            size: Math.max(12, Math.round(ctx.chart.width / 35))
          })
        }
      }
    }
  }
});
